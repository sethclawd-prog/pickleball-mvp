'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import RosterList from '@/components/RosterList';
import SessionTimelineHeatmap from '@/components/SessionTimelineHeatmap';
import ShareButton from '@/components/ShareButton';
import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import {
  dropParticipation,
  fetchSessionById,
  formatSessionTime,
  getParticipantWindow,
  getSessionBounds,
  summarizeCounts,
  updateParticipation
} from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { HALF_HOUR_OPTIONS, formatTimeRange, minutesFromTimeValue } from '@/lib/time-windows';
import type { ParticipantStatus, SessionWithParticipants, StoredIdentity } from '@/lib/types';

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [session, setSession] = useState<SessionWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [editingStatus, setEditingStatus] = useState<ParticipantStatus | null>(null);
  const [arrivesAt, setArrivesAt] = useState('17:00');
  const [departsAt, setDepartsAt] = useState('21:00');

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchSessionById(supabase, sessionId);
      setSession(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    setOrigin(window.location.origin);
    setIdentity(getStoredIdentity());
    void loadSession();

    const onIdentityUpdate = () => setIdentity(getStoredIdentity());
    window.addEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);

    if (!sessionId) {
      return () => {
        window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
      };
    }

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          void loadSession();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
      void supabase.removeChannel(channel);
    };
  }, [loadSession, sessionId, supabase]);

  const currentParticipation = useMemo(() => {
    if (!session || !identity) {
      return null;
    }

    return session.participants.find((participant) => participant.user_id === identity.id) ?? null;
  }, [identity, session]);

  const currentStatus = currentParticipation?.status ?? null;

  function openWindowPicker(status: ParticipantStatus) {
    if (!session) {
      return;
    }

    const fallbackWindow = getSessionBounds(session);
    const baseWindow = currentParticipation
      ? getParticipantWindow(session, currentParticipation)
      : fallbackWindow;

    setArrivesAt(baseWindow.arrivesAt);
    setDepartsAt(baseWindow.departsAt);
    setEditingStatus(status);
    setError(null);
  }

  async function submitParticipationWindow() {
    if (!identity || !session || !editingStatus) {
      return;
    }

    if (minutesFromTimeValue(arrivesAt) >= minutesFromTimeValue(departsAt)) {
      setError('Departure time must be after arrival time.');
      return;
    }

    try {
      setBusy(true);
      setError(null);

      await updateParticipation(supabase, {
        sessionId: session.id,
        userId: identity.id,
        status: editingStatus,
        arrivesAt,
        departsAt
      });

      setEditingStatus(null);
      await loadSession();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not update your status.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDrop() {
    if (!identity) {
      setError('Please set up your profile first (tap the prompt at the bottom of the screen).');
      return;
    }
    if (!session) {
      return;
    }

    try {
      setBusy(true);
      setError(null);

      // Try direct user_id match first
      let { error: deleteError, count } = await supabase
        .from('participants')
        .delete({ count: 'exact' })
        .eq('session_id', session.id)
        .eq('user_id', identity.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Fallback: if no match by user_id, find all user records for this phone
      // and try deleting by any matching user_id (handles duplicate user records)
      if (count === 0 && identity.phone) {
        const { data: phoneUsers } = await supabase
          .from('users')
          .select('id')
          .eq('phone', identity.phone);

        if (phoneUsers && phoneUsers.length > 0) {
          const userIds = phoneUsers.map((u) => u.id);
          const { error: fallbackError, count: fallbackCount } = await supabase
            .from('participants')
            .delete({ count: 'exact' })
            .eq('session_id', session.id)
            .in('user_id', userIds);

          if (fallbackError) {
            throw new Error(fallbackError.message);
          }
          count = fallbackCount;
        }
      }

      if (count === 0) {
        setError('Could not find your participation to remove. Try refreshing the page.');
        setBusy(false);
        return;
      }

      setEditingStatus(null);

      // If no participants left, delete the empty session and redirect home
      const { count: remaining } = await supabase
        .from('participants')
        .select('id', { head: true, count: 'exact' })
        .eq('session_id', session.id);

      if (remaining === 0) {
        await supabase.from('sessions').delete().eq('id', session.id);
        window.location.href = '/';
        return;
      }

      await loadSession();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not update your status.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink/60">Loading session...</p>;
  }

  if (!session) {
    return (
      <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-card">
        <h1 className="font-display text-2xl text-ink">Session unavailable</h1>
        <p className="mt-2 text-sm text-ink/70">This link may be expired or invalid.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Back to sessions
        </Link>
      </section>
    );
  }

  const shareUrl = `${origin}/join?code=${session.code}`;
  const currentWindow = currentParticipation ? getParticipantWindow(session, currentParticipation) : null;

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex text-sm font-semibold text-ink/70 hover:text-ink">
        ← Back
      </Link>

      <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          {formatSessionTime(session.starts_at, session.ends_at)}
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">{session.note || 'Open play at Bay Padel'}</h1>
        <p className="mt-2 text-sm text-ink/70">
          {session.venue} • {summarizeCounts(session)}
        </p>
        {session.court ? <p className="mt-1 text-sm text-ink/70">Court: {session.court}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => openWindowPicker('confirmed')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              currentStatus === 'confirmed' ? 'bg-success text-white' : 'bg-surface-2 text-ink hover:bg-accent-soft'
            }`}
          >
            Join
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => openWindowPicker('maybe')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              currentStatus === 'maybe' ? 'bg-warm text-ink' : 'bg-surface-2 text-ink hover:bg-accent-soft'
            }`}
          >
            Maybe
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDrop}
            className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-danger/10 hover:text-danger"
          >
            Drop
          </button>

          <ShareButton
            title="Pickleball session"
            text={`Join our Bay Padel session (${session.code})`}
            url={shareUrl}
          />
          <a
            href="https://book.baypadel.us/home"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Book a court on Bay Padel
          </a>
        </div>

        {currentWindow ? (
          <p className="mt-3 text-sm text-ink/70">You: {formatTimeRange(currentWindow.arrivesAt, currentWindow.departsAt)} ✓</p>
        ) : null}

        {editingStatus ? (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-soft/60 p-3">
            <p className="text-sm font-semibold text-ink">I&apos;ll be there from</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={arrivesAt}
                onChange={(event) => setArrivesAt(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-accent focus:ring-2"
              >
                {HALF_HOUR_OPTIONS.map((option) => (
                  <option key={`arrives-${option.value}`} value={option.value}>
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
                  <option key={`departs-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={submitParticipationWindow}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {editingStatus === 'confirmed' ? 'Confirm join' : 'Save maybe'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingStatus(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink/70 transition hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </section>

      <RosterList session={session} />
      <SessionTimelineHeatmap session={session} />
    </div>
  );
}
