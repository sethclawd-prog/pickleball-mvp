'use client';

import { addHours, format } from 'date-fns';
import { useMemo, useState, type FormEvent } from 'react';

import { createSession } from '@/lib/sessions';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { HALF_HOUR_OPTIONS } from '@/lib/time-windows';

interface CreateSessionModalProps {
  isOpen: boolean;
  userId?: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

function roundUpToHalfHour(input: Date): Date {
  const next = new Date(input);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();

  if (minutes === 0 || minutes === 30) {
    return next;
  }

  if (minutes < 30) {
    next.setMinutes(30);
    return next;
  }

  next.setHours(next.getHours() + 1);
  next.setMinutes(0);
  return next;
}

function toDateString(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function toTimeString(value: Date): string {
  return format(value, 'HH:mm');
}

function combineDateAndTime(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export default function CreateSessionModal({
  isOpen,
  userId,
  onClose,
  onCreated
}: CreateSessionModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [initialStart] = useState(() => roundUpToHalfHour(addHours(new Date(), 2)));
  const [sessionDate, setSessionDate] = useState(() => toDateString(initialStart));
  const [startTime, setStartTime] = useState(() => toTimeString(initialStart));
  const [endTime, setEndTime] = useState(() => toTimeString(addHours(initialStart, 2)));
  const [note, setNote] = useState('Doubles at Bay Padel');
  const [hasCapacity, setHasCapacity] = useState(false);
  const [capacity, setCapacity] = useState(8);
  const [court, setCourt] = useState('');
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

      const startDateTime = combineDateAndTime(sessionDate, startTime);
      const endDateTime = combineDateAndTime(sessionDate, endTime);
      if (endDateTime <= startDateTime) {
        setError('End time must be after start time.');
        setSaving(false);
        return;
      }

      const session = await createSession(supabase, {
        startsAt: startDateTime.toISOString(),
        endsAt: endDateTime.toISOString(),
        note,
        capacity: hasCapacity ? capacity : null,
        court,
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
            <span className="mb-1 block text-sm font-medium text-ink">Date</span>
            <input
              required
              type="date"
              value={sessionDate}
              onChange={(event) => setSessionDate(event.target.value)}
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Start time</span>
              <select
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
              >
                {HALF_HOUR_OPTIONS.map((option) => (
                  <option key={`start-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">End time</span>
              <select
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
              >
                {HALF_HOUR_OPTIONS.map((option) => (
                  <option key={`end-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
            <span className="mb-1 block text-sm font-medium text-ink">Which court(s) did you book?</span>
            <input
              type="text"
              value={court}
              onChange={(event) => setCourt(event.target.value)}
              placeholder="e.g. Court 3"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
            />
          </label>

          <div className="rounded-xl border border-ink/10 bg-surface-2 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={hasCapacity}
                onChange={(event) => setHasCapacity(event.target.checked)}
                className="h-4 w-4 rounded border-ink/30 text-accent focus:ring-accent"
              />
              Set player limit?
            </label>
            {hasCapacity ? (
              <label className="mt-2 block">
                <span className="mb-1 block text-sm font-medium text-ink">Player cap</span>
                <input
                  required
                  min={2}
                  max={16}
                  type="number"
                  value={capacity}
                  onChange={(event) => setCapacity(Number(event.target.value || 8))}
                  className="w-full rounded-xl border border-ink/15 px-3 py-2 text-ink outline-none ring-accent focus:ring-2"
                />
              </label>
            ) : (
              <p className="mt-2 text-xs text-ink/70">No cap set means unlimited confirmed players.</p>
            )}
          </div>

          <a
            href="https://book.baypadel.us/home"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Book a court on Bay Padel
          </a>

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
