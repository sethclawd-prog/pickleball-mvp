import { format, isValid, parseISO } from 'date-fns';

export interface TimeOption {
  value: string;
  label: string;
}

export interface TimeWindow {
  arrivesAt: string;
  departsAt: string;
}

export interface SlotCount {
  start: string;
  end: string;
  count: number;
}

export interface TimeRange {
  start: string;
  end: string;
  slotCount: number;
}

const MINUTES_PER_DAY = 24 * 60;
export const SLOT_DURATION_MINUTES = 30;

export const HALF_HOUR_OPTIONS: TimeOption[] = Array.from(
  { length: MINUTES_PER_DAY / SLOT_DURATION_MINUTES },
  (_, slotIndex) => {
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * SLOT_DURATION_MINUTES;
    const value = `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
    const label = format(new Date(2026, 0, 1, hour, minute, 0, 0), 'h:mm a');
    return { value, label };
  }
);

function parseTimeValue(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return null;
  }

  return `${`${parsed.hours}`.padStart(2, '0')}:${`${parsed.minutes}`.padStart(2, '0')}`;
}

export function minutesFromTimeValue(value: string): number {
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return 0;
  }

  return parsed.hours * 60 + parsed.minutes;
}

export function timeValueFromMinutes(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
}

export function formatTimeValue(value: string | null | undefined): string {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return 'Time TBD';
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  return format(new Date(2026, 0, 1, hours, minutes, 0, 0), 'h:mm a');
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeValue(start)} - ${formatTimeValue(end)}`;
}

export function sessionBoundsFromIso(
  startsAtIso: string,
  endsAtIso: string,
  fallback: TimeWindow = { arrivesAt: '17:00', departsAt: '21:00' }
): TimeWindow {
  const startsAt = parseISO(startsAtIso);
  const endsAt = parseISO(endsAtIso);

  if (!isValid(startsAt) || !isValid(endsAt)) {
    return fallback;
  }

  const arrivesAt = format(startsAt, 'HH:mm');
  const departsAt = format(endsAt, 'HH:mm');
  return { arrivesAt, departsAt };
}

export function clampWindowToBounds(window: TimeWindow, bounds: TimeWindow): TimeWindow | null {
  const windowStart = normalizeTimeValue(window.arrivesAt);
  const windowEnd = normalizeTimeValue(window.departsAt);
  const boundStart = normalizeTimeValue(bounds.arrivesAt);
  const boundEnd = normalizeTimeValue(bounds.departsAt);

  if (!windowStart || !windowEnd || !boundStart || !boundEnd) {
    return null;
  }

  const startMinutes = Math.max(minutesFromTimeValue(windowStart), minutesFromTimeValue(boundStart));
  const endMinutes = Math.min(minutesFromTimeValue(windowEnd), minutesFromTimeValue(boundEnd));

  if (startMinutes >= endMinutes) {
    return null;
  }

  return {
    arrivesAt: timeValueFromMinutes(startMinutes),
    departsAt: timeValueFromMinutes(endMinutes)
  };
}

export function resolveWindowWithFallback(
  arrivesAt: string | null | undefined,
  departsAt: string | null | undefined,
  fallback: TimeWindow
): TimeWindow {
  const normalizedArrives = normalizeTimeValue(arrivesAt) ?? fallback.arrivesAt;
  const normalizedDeparts = normalizeTimeValue(departsAt) ?? fallback.departsAt;
  return clampWindowToBounds(
    {
      arrivesAt: normalizedArrives,
      departsAt: normalizedDeparts
    },
    fallback
  ) ?? fallback;
}

function toMinuteWindow(window: TimeWindow): { start: number; end: number } | null {
  const start = normalizeTimeValue(window.arrivesAt);
  const end = normalizeTimeValue(window.departsAt);
  if (!start || !end) {
    return null;
  }

  const startMinutes = minutesFromTimeValue(start);
  const endMinutes = minutesFromTimeValue(end);
  if (startMinutes >= endMinutes) {
    return null;
  }

  return { start: startMinutes, end: endMinutes };
}

function alignDownToSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_DURATION_MINUTES) * SLOT_DURATION_MINUTES;
}

function alignUpToSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_DURATION_MINUTES) * SLOT_DURATION_MINUTES;
}

export function buildSlotCounts(windows: TimeWindow[], bounds?: TimeWindow): SlotCount[] {
  const normalizedWindows = windows
    .map((window) => toMinuteWindow(window))
    .filter((window): window is { start: number; end: number } => Boolean(window));

  if (!normalizedWindows.length) {
    return [];
  }

  let startBoundary = alignDownToSlot(Math.min(...normalizedWindows.map((window) => window.start)));
  let endBoundary = alignUpToSlot(Math.max(...normalizedWindows.map((window) => window.end)));

  if (bounds) {
    const normalizedBounds = toMinuteWindow(bounds);
    if (!normalizedBounds) {
      return [];
    }

    startBoundary = normalizedBounds.start;
    endBoundary = normalizedBounds.end;
  }

  if (startBoundary >= endBoundary) {
    return [];
  }

  const slots: SlotCount[] = [];

  for (let start = startBoundary; start < endBoundary; start += SLOT_DURATION_MINUTES) {
    const end = Math.min(start + SLOT_DURATION_MINUTES, endBoundary);
    const count = normalizedWindows.filter((window) => window.start < end && window.end > start).length;

    slots.push({
      start: timeValueFromMinutes(start),
      end: timeValueFromMinutes(end),
      count
    });
  }

  return slots;
}

function chooseLongerRange(current: TimeRange | null, candidate: TimeRange): TimeRange {
  if (!current) {
    return candidate;
  }

  if (candidate.slotCount > current.slotCount) {
    return candidate;
  }

  if (candidate.slotCount < current.slotCount) {
    return current;
  }

  return minutesFromTimeValue(candidate.start) < minutesFromTimeValue(current.start) ? candidate : current;
}

export function findPeakWindow(slotCounts: SlotCount[]): (TimeRange & { count: number }) | null {
  if (!slotCounts.length) {
    return null;
  }

  const peakCount = Math.max(...slotCounts.map((slot) => slot.count));
  if (peakCount <= 0) {
    return null;
  }

  let bestRange: TimeRange | null = null;
  let index = 0;

  while (index < slotCounts.length) {
    if (slotCounts[index].count !== peakCount) {
      index += 1;
      continue;
    }

    const rangeStart = slotCounts[index].start;
    let rangeEnd = slotCounts[index].end;
    let slots = 1;
    index += 1;

    while (index < slotCounts.length && slotCounts[index].count === peakCount) {
      rangeEnd = slotCounts[index].end;
      slots += 1;
      index += 1;
    }

    bestRange = chooseLongerRange(bestRange, {
      start: rangeStart,
      end: rangeEnd,
      slotCount: slots
    });
  }

  if (!bestRange) {
    return null;
  }

  return {
    ...bestRange,
    count: peakCount
  };
}

export function findRangeAtOrAbove(slotCounts: SlotCount[], threshold: number): TimeRange | null {
  if (!slotCounts.length || threshold <= 0) {
    return null;
  }

  let bestRange: TimeRange | null = null;
  let index = 0;

  while (index < slotCounts.length) {
    if (slotCounts[index].count < threshold) {
      index += 1;
      continue;
    }

    const rangeStart = slotCounts[index].start;
    let rangeEnd = slotCounts[index].end;
    let slots = 1;
    index += 1;

    while (index < slotCounts.length && slotCounts[index].count >= threshold) {
      rangeEnd = slotCounts[index].end;
      slots += 1;
      index += 1;
    }

    bestRange = chooseLongerRange(bestRange, {
      start: rangeStart,
      end: rangeEnd,
      slotCount: slots
    });
  }

  return bestRange;
}
