'use client';

import clsx from 'clsx';
import { Fragment } from 'react';

import { TIME_SLOTS, WEEKDAYS, cellKey, formatSlotLabel } from '@/lib/availability';

interface AvailabilityGridProps {
  selection: Set<string>;
  onToggle: (weekday: number, slotIndex: number) => void;
}

export default function AvailabilityGrid({ selection, onToggle }: AvailabilityGridProps) {
  const gridTemplateColumns = `80px repeat(${TIME_SLOTS.length}, minmax(72px, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-3 shadow-card">
      <div className="min-w-max">
        <div className="grid gap-2" style={{ gridTemplateColumns }}>
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Day</div>
          {TIME_SLOTS.map((slot) => (
            <div key={slot} className="px-2 py-1 text-center text-xs font-semibold tracking-wide text-ink/50">
              {formatSlotLabel(slot)}
            </div>
          ))}

          {WEEKDAYS.map((day, weekday) => (
            <Fragment key={day}>
              <div className="px-2 py-2 text-sm font-semibold text-ink">
                {day}
              </div>
              {TIME_SLOTS.map((slot, slotIndex) => {
                const selected = selection.has(cellKey(weekday, slotIndex));
                return (
                  <button
                    key={`${day}-${slot}`}
                    type="button"
                    onClick={() => onToggle(weekday, slotIndex)}
                    className={clsx(
                      'h-10 rounded-lg border text-xs font-semibold transition',
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-ink/10 bg-surface-2 text-ink/60 hover:border-accent/40'
                    )}
                  >
                    {selected ? 'Free' : '-'}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
