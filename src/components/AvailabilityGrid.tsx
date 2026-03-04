'use client';

import clsx from 'clsx';

import { TIME_SLOTS, WEEKDAYS, cellKey } from '@/lib/availability';

interface AvailabilityGridProps {
  selection: Set<string>;
  onToggle: (weekday: number, slotIndex: number) => void;
}

export default function AvailabilityGrid({ selection, onToggle }: AvailabilityGridProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-3 shadow-card">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[80px_repeat(8,minmax(72px,1fr))] gap-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Day</div>
          {TIME_SLOTS.map((slot) => (
            <div key={slot} className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-ink/50">
              {slot}
            </div>
          ))}

          {WEEKDAYS.map((day, weekday) => (
            <div
              key={day}
              className="col-span-9 grid grid-cols-[80px_repeat(8,minmax(72px,1fr))] gap-2"
            >
              <div key={`${day}-label`} className="px-2 py-2 text-sm font-semibold text-ink">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
