import type { SessionWithParticipants } from '@/lib/types';
import { sortRosterEntries } from '@/lib/sessions';

interface RosterListProps {
  session: SessionWithParticipants;
}

function NameList({ labels, emptyText }: { labels: string[]; emptyText: string }) {
  if (!labels.length) {
    return <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink/60">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {labels.map((label, index) => (
        <li key={`${label}-${index}`} className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink">
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function RosterList({ session }: RosterListProps) {
  const confirmedEntries = sortRosterEntries(session, 'confirmed');
  const maybeEntries = sortRosterEntries(session, 'maybe');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Confirmed</h2>
          <span className="rounded-lg bg-success/20 px-2 py-1 text-xs font-semibold text-success">
            {confirmedEntries.length}
          </span>
        </div>
        <NameList labels={confirmedEntries.map((entry) => entry.label)} emptyText="No one confirmed yet." />
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Maybe</h2>
          <span className="rounded-lg bg-warm/40 px-2 py-1 text-xs font-semibold text-ink">
            {maybeEntries.length}
          </span>
        </div>
        <NameList labels={maybeEntries.map((entry) => entry.label)} emptyText="No maybes right now." />
      </section>
    </div>
  );
}
