'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import CreateSessionModal from '@/components/CreateSessionModal';
import SessionCard from '@/components/SessionCard';
import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import { fetchTodaySessions } from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { SessionWithParticipants, StoredIdentity } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [sessions, setSessions] = useState<SessionWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  useEffect(() => {
    setIdentity(getStoredIdentity());
    void loadSessions();

    const channel = supabase
      .channel('home-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        void loadSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        void loadSessions();
      })
      .subscribe();

    const onIdentityUpdate = () => setIdentity(getStoredIdentity());
    window.addEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);

    return () => {
      window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
      void supabase.removeChannel(channel);
    };
  }, [loadSessions, supabase]);

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
