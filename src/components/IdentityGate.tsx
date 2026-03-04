'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { getStoredIdentity, upsertIdentity } from '@/lib/identity';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function IdentityGate() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedInvite = process.env.NEXT_PUBLIC_GROUP_INVITE_CODE?.trim();

  useEffect(() => {
    const existing = getStoredIdentity();
    if (existing) {
      setReady(true);
      return;
    }

    setReady(false);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (expectedInvite && inviteCode.trim() !== expectedInvite) {
      setError('Invite code does not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await upsertIdentity(supabase, { name, phone });
      setReady(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  }

  if (ready) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 md:items-center md:justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl text-ink">Quick intro</h2>
        <p className="mt-2 text-sm text-ink/70">
          Enter your name and phone once so your crew can see exactly who&apos;s in.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Name</span>
            <input
              required
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Phone</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          {expectedInvite ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Group code</span>
              <input
                required
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="BayCrew"
                className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving profile...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
