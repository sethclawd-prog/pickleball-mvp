'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import {
  fetchSessionByCode,
  formatSessionTime,
  summarizeCounts,
  updateParticipation
} from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { SessionWithParticipants, StoredIdentity } from '@/lib/types';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.toUpperCase() ?? '';
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [session, setSession] = useState<SessionWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getStoredIdentity());
    const onIdentityUpdate = () => setIdentity(getStoredIdentity());
    window.addEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);

    return () => {
      window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
    };
  }, []);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const found = await fetchSessionByCode(supabase, code);
        setSession(found);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not find this session.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [code, supabase]);

  async function quickJoin(status: 'confirmed' | 'maybe') {
    if (!identity || !session) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      await updateParticipation(supabase, {
        sessionId: session.id,
        userId: identity.id,
        status
      });
      router.push(`/session/${session.id}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to update your status.');
    } finally {
      setBusy(false);
    }
  }

  if (!code) {
    return (
      <section className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-card">
        <h1 className="font-display text-2xl text-ink">Missing session code</h1>
        <p className="mt-2 text-sm text-ink/70">Use a full link from WhatsApp to join a game.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          View sessions
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="text-sm text-ink/60">Looking up session...</p>;
  }

  if (!session) {
    return (
      <section className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-card">
        <h1 className="font-display text-2xl text-ink">Session not found</h1>
        <p className="mt-2 text-sm text-ink/70">The code {code} is invalid or expired.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Back home
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Join from WhatsApp</p>
      <h1 className="mt-1 font-display text-3xl text-ink">{session.note || 'Open play at Bay Padel'}</h1>
      <p className="mt-2 text-sm text-ink/70">
        {formatSessionTime(session.starts_at)} • {summarizeCounts(session)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !identity}
          onClick={() => quickJoin('confirmed')}
          className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          I&apos;m in
        </button>
        <button
          type="button"
          disabled={busy || !identity}
          onClick={() => quickJoin('maybe')}
          className="rounded-xl bg-warm px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Maybe
        </button>
        <Link href={`/session/${session.id}`} className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold text-ink">
          Open details
        </Link>
      </div>

      {!identity ? <p className="mt-3 text-sm text-ink/60">Add your profile first to join.</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
