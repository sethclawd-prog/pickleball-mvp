import { format } from 'date-fns';

import type { AvailabilityTemplate } from '@/lib/types';

const START_MINUTES = 5 * 60;
const END_MINUTES = 22 * 60;
const MINUTES_PER_SLOT = 30;

export const TIME_SLOTS = Array.from(
  { length: (END_MINUTES - START_MINUTES) / MINUTES_PER_SLOT + 1 },
  (_, index) => {
    const totalMinutes = START_MINUTES + index * MINUTES_PER_SLOT;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
  }
);

export const SLOT_DURATION_MINUTES = 30;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function cellKey(weekday: number, slotIndex: number): string {
  return `${weekday}-${slotIndex}`;
}

function minutesFromTimeValue(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeFromMinutes(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}:00`;
}

export function formatSlotLabel(slot: string): string {
  const [hours, minutes] = slot.split(':').map(Number);
  return format(new Date(2026, 0, 1, hours, minutes, 0, 0), 'h:mm a');
}

export function templateRowsFromSelection(selection: Set<string>, userId: string): Omit<AvailabilityTemplate, 'id' | 'created_at' | 'updated_at'>[] {
  const rows: Omit<AvailabilityTemplate, 'id' | 'created_at' | 'updated_at'>[] = [];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    let startSlot: number | null = null;

    for (let slot = 0; slot <= TIME_SLOTS.length; slot += 1) {
      const selected = slot < TIME_SLOTS.length && selection.has(cellKey(weekday, slot));

      if (selected && startSlot === null) {
        startSlot = slot;
      }

      if (!selected && startSlot !== null) {
        const startMinutes = minutesFromTimeValue(TIME_SLOTS[startSlot]);
        const endMinutes =
          slot < TIME_SLOTS.length
            ? minutesFromTimeValue(TIME_SLOTS[slot])
            : minutesFromTimeValue(TIME_SLOTS[TIME_SLOTS.length - 1]) + SLOT_DURATION_MINUTES;

        rows.push({
          user_id: userId,
          weekday,
          start_time: formatTimeFromMinutes(startMinutes),
          end_time: formatTimeFromMinutes(endMinutes)
        });

        startSlot = null;
      }
    }
  }

  return rows;
}

export function selectionFromTemplateRows(rows: AvailabilityTemplate[]): Set<string> {
  const selection = new Set<string>();

  rows.forEach((row) => {
    const startMinutes = minutesFromTimeValue(row.start_time);
    const endMinutes = minutesFromTimeValue(row.end_time);

    for (let minute = startMinutes; minute < endMinutes; minute += SLOT_DURATION_MINUTES) {
      const slotIndex = TIME_SLOTS.findIndex((slot) => minutesFromTimeValue(slot) === minute);
      if (slotIndex >= 0) {
        selection.add(cellKey(row.weekday, slotIndex));
      }
    }
  });

  return selection;
}
