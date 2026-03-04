import Link from 'next/link';

import type { SessionWithParticipants } from '@/lib/types';
import { formatSessionTime, sortRosterNames, summarizeCounts } from '@/lib/sessions';

interface SessionCardProps {
  session: SessionWithParticipants;
}

export default function SessionCard({ session }: SessionCardProps) {
  const confirmed = sortRosterNames(session, 'confirmed');
  const maybe = sortRosterNames(session, 'maybe');

  return (
    <Link
      href={`/session/${session.id}`}
      className="block rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            {formatSessionTime(session.starts_at, session.ends_at)}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{session.note || 'Open play at Bay Padel'}</h3>
        </div>
        <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-ink">{session.code}</span>
      </div>

      <p className="mt-3 text-sm font-semibold text-ink">{summarizeCounts(session)}</p>
      {session.court ? <p className="mt-1 text-xs text-ink/70">Court: {session.court}</p> : null}

      <div className="mt-3 space-y-2 text-sm">
        <p className="text-ink/80">
          In: {confirmed.length ? confirmed.join(', ') : 'No one yet'}
        </p>
        <p className="text-ink/60">
          Maybe: {maybe.length ? maybe.join(', ') : 'No maybes'}
        </p>
      </div>
    </Link>
  );
}
