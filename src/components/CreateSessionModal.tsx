'use client';

import { addHours, format } from 'date-fns';
import { useMemo, useState, type FormEvent } from 'react';

import { createSession } from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';

interface CreateSessionModalProps {
  isOpen: boolean;
  userId?: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

export default function CreateSessionModal({
  isOpen,
  userId,
  onClose,
  onCreated
}: CreateSessionModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [startsAt, setStartsAt] = useState(() => format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm"));
  const [note, setNote] = useState('Doubles at Bay Padel');
  const [capacity, setCapacity] = useState(8);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError('Please complete your profile first.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const session = await createSession(supabase, {
        startsAt: new Date(startsAt).toISOString(),
        note,
        capacity,
        createdBy: userId
      });

      onCreated(session.id);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create session.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 md:items-center md:justify-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-ink">Create session</h2>
            <p className="mt-1 text-sm text-ink/70">Fast setup for same-day play.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink/70"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Date & time</span>
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Note</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Doubles at Bay Padel"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Player cap</span>
            <input
              min={2}
              max={16}
              type="number"
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value || 8))}
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Creating session...' : 'Create and share'}
          </button>
        </form>
      </div>
    </div>
  );
}
