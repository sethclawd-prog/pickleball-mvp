import type { AvailabilityTemplate } from '@/lib/types';

export const TIME_SLOTS = [
  '06:00',
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00'
];

export const SLOT_DURATION_HOURS = 2;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function cellKey(weekday: number, slotIndex: number): string {
  return `${weekday}-${slotIndex}`;
}

function hourFromSlot(slot: string): number {
  return Number(slot.split(':')[0]);
}

function formatHour(hour: number): string {
  const normalized = `${hour}`.padStart(2, '0');
  return `${normalized}:00:00`;
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
        const startHour = hourFromSlot(TIME_SLOTS[startSlot]);
        const endHour = hourFromSlot(TIME_SLOTS[Math.min(slot, TIME_SLOTS.length - 1)]) + SLOT_DURATION_HOURS;

        rows.push({
          user_id: userId,
          weekday,
          start_time: formatHour(startHour),
          end_time: formatHour(endHour)
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
    const startHour = Number(row.start_time.slice(0, 2));
    const endHour = Number(row.end_time.slice(0, 2));

    for (let hour = startHour; hour < endHour; hour += SLOT_DURATION_HOURS) {
      const slotIndex = TIME_SLOTS.findIndex((slot) => Number(slot.slice(0, 2)) === hour);
      if (slotIndex >= 0) {
        selection.add(cellKey(row.weekday, slotIndex));
      }
    }
  });

  return selection;
}
