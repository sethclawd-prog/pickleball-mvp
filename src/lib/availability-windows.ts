import { format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

import { buildSlotCounts, findPeakWindow } from '@/lib/time-windows';
import type { AppUser, AvailabilityWindow, Database } from '@/lib/types';

export type AvailabilityWindowWithUser = AvailabilityWindow & {
  user?: Pick<AppUser, 'id' | 'name' | 'phone'> | null;
};

function mapAvailabilityWindow(raw: any): AvailabilityWindowWithUser {
  return {
    id: raw.id,
    user_id: raw.user_id,
    date: raw.date,
    arrives_at: raw.arrives_at,
    departs_at: raw.departs_at,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    user: raw.users
      ? {
          id: raw.users.id,
          name: raw.users.name,
          phone: raw.users.phone
        }
      : null
  };
}

export function toDateString(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export async function fetchAvailabilityWindowsForDate(
  supabase: SupabaseClient<Database>,
  date: string
): Promise<AvailabilityWindowWithUser[]> {
  const { data, error } = await supabase
    .from('availability_windows')
    .select(
      `
      id,
      user_id,
      date,
      arrives_at,
      departs_at,
      created_at,
      updated_at,
      users (
        id,
        name,
        phone
      )
    `
    )
    .eq('date', date)
    .order('arrives_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapAvailabilityWindow);
}

export async function upsertAvailabilityWindow(
  supabase: SupabaseClient<Database>,
  payload: {
    userId: string;
    date: string;
    arrivesAt: string;
    departsAt: string;
  }
): Promise<AvailabilityWindowWithUser> {
  const { data, error } = await supabase
    .from('availability_windows')
    .upsert(
      {
        user_id: payload.userId,
        date: payload.date,
        arrives_at: payload.arrivesAt,
        departs_at: payload.departsAt
      },
      {
        onConflict: 'user_id,date'
      }
    )
    .select(
      `
      id,
      user_id,
      date,
      arrives_at,
      departs_at,
      created_at,
      updated_at,
      users (
        id,
        name,
        phone
      )
    `
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not save availability window.');
  }

  return mapAvailabilityWindow(data);
}

export async function removeAvailabilityWindow(
  supabase: SupabaseClient<Database>,
  payload: {
    userId: string;
    date: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('availability_windows')
    .delete()
    .eq('user_id', payload.userId)
    .eq('date', payload.date);

  if (error) {
    throw new Error(error.message);
  }
}

export function findAvailabilityWindowForUser(
  windows: AvailabilityWindowWithUser[],
  userId: string | null | undefined
): AvailabilityWindowWithUser | null {
  if (!userId) {
    return null;
  }

  return windows.find((window) => window.user_id === userId) ?? null;
}

export function summarizeAvailabilityPeak(
  windows: Array<Pick<AvailabilityWindow, 'arrives_at' | 'departs_at'>>
): {
  start: string;
  end: string;
  count: number;
} | null {
  if (!windows.length) {
    return null;
  }

  const slotCounts = buildSlotCounts(
    windows.map((window) => ({
      arrivesAt: window.arrives_at,
      departsAt: window.departs_at
    }))
  );
  const peak = findPeakWindow(slotCounts);

  if (!peak) {
    return null;
  }

  return {
    start: peak.start,
    end: peak.end,
    count: peak.count
  };
}
