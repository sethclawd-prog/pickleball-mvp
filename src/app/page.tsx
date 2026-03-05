'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import CreateSessionModal from '@/components/CreateSessionModal';
import SessionCard from '@/components/SessionCard';
import {
  fetchAvailabilityWindowsForDate,
  findAvailabilityWindowForUser,
  removeAvailabilityWindow,
  summarizeAvailabilityPeak,
  toDateString,
  upsertAvailabilityWindow,
  type AvailabilityWindowWithUser
} from '@/lib/availability-windows';
import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import { fetchTodaySessions } from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { HALF_HOUR_OPTIONS, formatTimeRange, minutesFromTimeValue } from '@/lib/time-windows';
import type { SessionWithParticipants, StoredIdentity } from '@/lib/types';

const EVENING_START_TIME = '17:00:00';
const EVENING_END_TIME = '22:00:00';

type UsuallyFreeUser = {
  id: string;
  name: string;
};

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const todayDate = useMemo(() => toDateString(), []);
  const todayWeekday = useMemo(() => new Date().getDay(), []);

  const [sessions, setSessions] = useState<SessionWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [availabilityWindows, setAvailabilityWindows] = useState<AvailabilityWindowWithUser[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [arrivesAt, setArrivesAt] = useState('17:00');
  const [departsAt, setDepartsAt] = useState('21:00');
  const [usuallyFreeUsers, setUsuallyFreeUsers] = useState<UsuallyFreeUser[]>([]);
  const [usuallyFreeLoading, setUsuallyFreeLoading] = useState(true);
  const [usuallyFreeError, setUsuallyFreeError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchTodaySessions(supabase);
      setSessions(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadAvailability = useCallback(async () => {
    try {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      const result = await fetchAvailabilityWindowsForDate(supabase, todayDate);
      setAvailabilityWindows(result);
    } catch (loadError) {
      setAvailabilityError(loadError instanceof Error ? loadError.message : 'Could not load availability windows.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [supabase, todayDate]);

  const loadUsuallyFreeUsers = useCallback(async () => {
    try {
      setUsuallyFreeLoading(true);
      setUsuallyFreeError(null);

      const { data, error: queryError } = await supabase
        .from('availability_templates')
        .select(
          `
          user_id,
          start_time,
          end_time,
          users (
            id,
            name
          )
        `
        )
        .eq('weekday', todayWeekday)
        .lt('start_time', EVENING_END_TIME)
        .gt('end_time', EVENING_START_TIME);

      if (queryError) {
        throw new Error(queryError.message);
      }

      const uniqueUsers = new Map<string, UsuallyFreeUser>();
      (data ?? []).forEach((row: any) => {
        const relatedUser = Array.isArray(row.users) ? row.users[0] : row.users;
        if (!relatedUser?.id || !relatedUser?.name || uniqueUsers.has(row.user_id)) {
          return;
        }

        uniqueUsers.set(row.user_id, {
          id: row.user_id,
          name: relatedUser.name
        });
      });

      setUsuallyFreeUsers(
        Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (loadError) {
      setUsuallyFreeUsers([]);
      setUsuallyFreeError(loadError instanceof Error ? loadError.message : 'Could not load weekly availability.');
    } finally {
      setUsuallyFreeLoading(false);
    }
  }, [supabase, todayWeekday]);

  useEffect(() => {
    setIdentity(getStoredIdentity());
    void loadSessions();
    void loadAvailability();
    void loadUsuallyFreeUsers();

    const channel = supabase
      .channel('home-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        void loadSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        void loadSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_windows' }, () => {
        void loadAvailability();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_templates' }, () => {
        void loadUsuallyFreeUsers();
      })
      .subscribe();

    const onIdentityUpdate = () => setIdentity(getStoredIdentity());
    window.addEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);

    return () => {
      window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
      void supabase.removeChannel(channel);
    };
  }, [loadAvailability, loadSessions, loadUsuallyFreeUsers, supabase]);

  const yourWindow = useMemo(
    () => findAvailabilityWindowForUser(availabilityWindows, identity?.id),
    [availabilityWindows, identity?.id]
  );

  const othersAvailableToday = useMemo(
    () => availabilityWindows.filter((window) => window.user_id !== identity?.id),
    [availabilityWindows, identity?.id]
  );

  const availabilityPeak = useMemo(
    () => summarizeAvailabilityPeak(availabilityWindows),
    [availabilityWindows]
  );

  const usuallyFreeTonightNames = useMemo(
    () =>
      usuallyFreeUsers
        .filter((user) => user.id !== identity?.id)
        .map((user) => user.name),
    [usuallyFreeUsers, identity?.id]
  );

  const usuallyFreeTonightPreview = useMemo(
    () => usuallyFreeTonightNames.slice(0, 3),
    [usuallyFreeTonightNames]
  );

  const usuallyFreeTonightExtraCount = Math.max(
    usuallyFreeTonightNames.length - usuallyFreeTonightPreview.length,
    0
  );

  useEffect(() => {
    if (!yourWindow || editingAvailability) {
      return;
    }

    setArrivesAt(yourWindow.arrives_at.slice(0, 5));
    setDepartsAt(yourWindow.departs_at.slice(0, 5));
  }, [editingAvailability, yourWindow]);

  function startEditingAvailability() {
    if (yourWindow) {
      setArrivesAt(yourWindow.arrives_at.slice(0, 5));
      setDepartsAt(yourWindow.departs_at.slice(0, 5));
    }

    setEditingAvailability(true);
    setAvailabilityError(null);
  }

  async function handleSaveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identity) {
      setAvailabilityError('Add your profile first to share your availability.');
      return;
    }

    if (minutesFromTimeValue(arrivesAt) >= minutesFromTimeValue(departsAt)) {
      setAvailabilityError('Departure time must be after arrival time.');
      return;
    }

    try {
      setAvailabilitySaving(true);
      setAvailabilityError(null);

      await upsertAvailabilityWindow(supabase, {
        userId: identity.id,
        date: todayDate,
        arrivesAt,
        departsAt
      });

      setEditingAvailability(false);
      await loadAvailability();
    } catch (saveError) {
      setAvailabilityError(saveError instanceof Error ? saveError.message : 'Could not save availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function handleRemoveAvailability() {
    if (!identity) {
      return;
    }

    try {
      setAvailabilitySaving(true);
      setAvailabilityError(null);

      await removeAvailabilityWindow(supabase, {
        userId: identity.id,
        date: todayDate
      });

      setEditingAvailability(false);
      await loadAvailability();
    } catch (removeError) {
      setAvailabilityError(removeError instanceof Error ? removeError.message : 'Could not remove availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-ink px-5 py-6 text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Bay Padel Crew</p>
        <h1 className="mt-2 font-display text-3xl">Today&apos;s sessions</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Same-day coordination without the WhatsApp scroll chaos. Create a game and share the link.
        </p>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mt-4 rounded-xl bg-warm px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
        >
          + Create session
        </button>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card">
        <h2 className="font-semibold text-ink">Drop your availability for today</h2>
        <p className="mt-1 text-sm text-ink/70">I&apos;ll be around from __ to __</p>

        {availabilityLoading ? <p className="mt-3 text-sm text-ink/60">Loading today&apos;s windows...</p> : null}

        {!availabilityLoading && yourWindow && !editingAvailability ? (
          <div className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-ink">
            <p>You: {formatTimeRange(yourWindow.arrives_at, yourWindow.departs_at)} ✓</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={startEditingAvailability}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-surface-2"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={availabilitySaving}
                onClick={handleRemoveAvailability}
                className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:opacity-90"
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}

        {(!yourWindow || editingAvailability) && !availabilityLoading ? (
          <form onSubmit={handleSaveAvailability} className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={arrivesAt}
                onChange={(event) => setArrivesAt(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-accent focus:ring-2"
              >
                {HALF_HOUR_OPTIONS.map((option) => (
                  <option key={`available-from-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={departsAt}
                onChange={(event) => setDepartsAt(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-accent focus:ring-2"
              >
                {HALF_HOUR_OPTIONS.map((option) => (
                  <option key={`available-to-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={availabilitySaving || !identity}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {availabilitySaving ? 'Saving...' : "I'm available"}
              </button>
              {yourWindow ? (
                <button
                  type="button"
                  disabled={availabilitySaving}
                  onClick={() => setEditingAvailability(false)}
                  className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold text-ink/70"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {availabilityError ? <p className="mt-3 text-sm text-danger">{availabilityError}</p> : null}

        {availabilityPeak ? (
          <p className="mt-3 text-sm font-medium text-ink">
            📊 Peak tonight: {formatTimeRange(availabilityPeak.start, availabilityPeak.end)} ({availabilityPeak.count}{' '}
            people available)
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink/60">No overlap posted yet for today.</p>
        )}

        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-ink">Who else is around today</p>
          {!othersAvailableToday.length ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink/60">No one else has posted yet.</p>
          ) : (
            <ul className="space-y-2">
              {othersAvailableToday.map((window) => (
                <li key={window.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink">
                  {window.user?.name ?? 'Player'}: {formatTimeRange(window.arrives_at, window.departs_at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">Usually free today</h2>

        {usuallyFreeLoading ? <p className="mt-2 text-sm text-ink/60">Checking weekly templates...</p> : null}
        {usuallyFreeError ? <p className="mt-2 text-sm text-danger">{usuallyFreeError}</p> : null}

        {!usuallyFreeLoading && !usuallyFreeError && !usuallyFreeTonightNames.length ? (
          <p className="mt-2 text-sm text-ink/60">No one has posted evening weekly availability yet.</p>
        ) : null}

        {!usuallyFreeLoading && !usuallyFreeError && usuallyFreeTonightNames.length ? (
          <p className="mt-2 text-sm text-ink">
            Usually free tonight: {usuallyFreeTonightPreview.join(', ')}
            {usuallyFreeTonightExtraCount > 0 ? ` (+${usuallyFreeTonightExtraCount} more)` : ''}
          </p>
        ) : null}
      </section>

      {loading ? <p className="text-sm text-ink/60">Loading sessions...</p> : null}
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {!loading && !sessions.length ? (
        <section className="rounded-2xl border border-white/70 bg-white/90 p-5 text-sm text-ink/70 shadow-card">
          No sessions yet today. Start one for tonight.
        </section>
      ) : null}

      <section className="space-y-3">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </section>

      <CreateSessionModal
        isOpen={createOpen}
        userId={identity?.id}
        onClose={() => setCreateOpen(false)}
        onCreated={(sessionId) => {
          setCreateOpen(false);
          router.push(`/session/${sessionId}`);
        }}
      />
    </div>
  );
}
