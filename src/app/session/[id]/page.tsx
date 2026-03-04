'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import RosterList from '@/components/RosterList';
import ShareButton from '@/components/ShareButton';
import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import {
  dropParticipation,
  fetchSessionById,
  formatSessionTime,
  summarizeCounts,
  updateParticipation
} from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
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

  const currentStatus = useMemo<ParticipantStatus | null>(() => {
    if (!session || !identity) {
      return null;
    }

    const existing = session.participants.find((participant) => participant.user_id === identity.id);
    return existing?.status ?? null;
  }, [identity, session]);

  async function handleStatusChange(next: ParticipantStatus | 'drop') {
    if (!identity || !session) {
      return;
    }

    try {
      setBusy(true);
      setError(null);

      if (next === 'drop') {
        await dropParticipation(supabase, {
          sessionId: session.id,
          userId: identity.id
        });
      } else {
        await updateParticipation(supabase, {
          sessionId: session.id,
          userId: identity.id,
          status: next
        });
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
            onClick={() => handleStatusChange('confirmed')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              currentStatus === 'confirmed' ? 'bg-success text-white' : 'bg-surface-2 text-ink hover:bg-accent-soft'
            }`}
          >
            Join
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange('maybe')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              currentStatus === 'maybe' ? 'bg-warm text-ink' : 'bg-surface-2 text-ink hover:bg-accent-soft'
            }`}
          >
            Maybe
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange('drop')}
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
            href="https://www.baypadel.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Book a court on Bay Padel
          </a>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </section>

      <RosterList session={session} />
    </div>
  );
}
