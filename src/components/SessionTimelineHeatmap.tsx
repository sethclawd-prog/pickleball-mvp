'use client';

import clsx from 'clsx';

import { buildConfirmedSlotCounts } from '@/lib/sessions';
import { findPeakWindow, findRangeAtOrAbove, formatTimeRange, formatTimeValue } from '@/lib/time-windows';
import type { SessionWithParticipants } from '@/lib/types';

interface SessionTimelineHeatmapProps {
  session: SessionWithParticipants;
}

function slotToneClass(count: number): string {
  if (count <= 0) {
    return 'bg-surface-2 text-ink/50';
  }

  if (count <= 3) {
    return 'bg-accent-soft text-ink';
  }

  if (count <= 7) {
    return 'bg-accent text-white';
  }

  if (count <= 11) {
    return 'bg-success text-white';
  }

  return 'bg-ink text-white';
}

function courtRangeLabel(players: number): string {
  const minCourts = Math.max(1, Math.floor(players / 4));
  const maxCourts = Math.max(minCourts, Math.ceil(players / 4));
  return minCourts === maxCourts ? `${minCourts}` : `${minCourts}-${maxCourts}`;
}

export default function SessionTimelineHeatmap({ session }: SessionTimelineHeatmapProps) {
  const slots = buildConfirmedSlotCounts(session);
  if (!slots.length) {
    return null;
  }

  const peak = findPeakWindow(slots);
  const recommendationRange = peak ? findRangeAtOrAbove(slots, Math.max(4, peak.count - 2)) : null;
  const shouldRecommendCourts = Boolean(peak && peak.count >= 4 && recommendationRange);

  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card">
      <h2 className="font-semibold text-ink">Player timeline</h2>
      <p className="mt-1 text-sm text-ink/70">30-minute coverage across this session window.</p>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-max items-end gap-1">
          {slots.map((slot) => {
            const height = Math.max(26, slot.count * 10 + 10);
            return (
              <div key={`${slot.start}-${slot.end}`} className="w-11 text-center">
                <div
                  className={clsx(
                    'flex w-full items-center justify-center rounded-t-lg px-1 text-xs font-semibold',
                    slotToneClass(slot.count)
                  )}
                  style={{ height: `${height}px` }}
                >
                  {slot.count}
                </div>
                <p className="mt-1 text-[10px] text-ink/60">{formatTimeValue(slot.start)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {peak ? (
        <p className="mt-3 text-sm font-medium text-ink">
          🔥 Peak: {formatTimeRange(peak.start, peak.end)} ({peak.count} players)
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink/60">No confirmed overlap yet.</p>
      )}

      {shouldRecommendCourts ? (
        <p className="mt-1 text-sm text-ink/80">
          Book {courtRangeLabel(peak!.count)} courts for{' '}
          {formatTimeRange(recommendationRange!.start, recommendationRange!.end)}
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink/60">Court recommendation appears once 4+ players overlap.</p>
      )}
    </section>
  );
}
