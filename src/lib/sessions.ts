import {
  addDays,
  addHours,
  endOfDay,
  format,
  formatISO,
  isToday,
  isValid,
  parseISO,
  startOfDay
} from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildSlotCounts,
  findPeakWindow,
  findRangeAtOrAbove,
  formatTimeRange,
  formatTimeValue,
  resolveWindowWithFallback,
  sessionBoundsFromIso,
  type SlotCount,
  type TimeRange,
  type TimeWindow
} from '@/lib/time-windows';
import type {
  Database,
  Participant,
  ParticipantStatus,
  Session,
  SessionWithParticipants
} from '@/lib/types';

const sessionSelect = `
  id,
  code,
  starts_at,
  ends_at,
  note,
  capacity,
  court,
  venue,
  created_by,
  created_at,
  updated_at,
  participants (
    id,
    session_id,
    user_id,
    status,
    arrives_at,
    departs_at,
    created_at,
    updated_at,
    users (
      id,
      name,
      phone
    )
  )
`;

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function normalizeEndsAt(startsAt: string, endsAt: string | null | undefined): string {
  const endDate = parseIsoDate(endsAt);
  if (endDate && endsAt) {
    return endsAt;
  }

  const startDate = parseIsoDate(startsAt);
  if (!startDate) {
    return startsAt;
  }

  return addHours(startDate, 2).toISOString();
}

function mapSession(raw: any): SessionWithParticipants {
  const participants = (raw.participants ?? []).map((participant: any) => ({
    id: participant.id,
    session_id: participant.session_id,
    user_id: participant.user_id,
    status: participant.status,
    arrives_at: participant.arrives_at,
    departs_at: participant.departs_at,
    created_at: participant.created_at,
    updated_at: participant.updated_at,
    user: participant.users
      ? {
          id: participant.users.id,
          name: participant.users.name,
          phone: participant.users.phone
        }
      : null
  }));

  return {
    id: raw.id,
    code: raw.code,
    starts_at: raw.starts_at,
    ends_at: normalizeEndsAt(raw.starts_at, raw.ends_at),
    note: raw.note,
    capacity: raw.capacity,
    court: raw.court,
    venue: raw.venue,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    participants
  };
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getSessionBounds(session: Pick<Session, 'starts_at' | 'ends_at'>): TimeWindow {
  return sessionBoundsFromIso(session.starts_at, session.ends_at);
}

export function getParticipantWindow(
  session: Pick<Session, 'starts_at' | 'ends_at'>,
  participant: Pick<Participant, 'arrives_at' | 'departs_at'>
): TimeWindow {
  return resolveWindowWithFallback(participant.arrives_at, participant.departs_at, getSessionBounds(session));
}

export function formatParticipantWindow(
  session: Pick<Session, 'starts_at' | 'ends_at'>,
  participant: Pick<Participant, 'arrives_at' | 'departs_at'>
): string {
  const window = getParticipantWindow(session, participant);
  return formatTimeRange(window.arrivesAt, window.departsAt);
}

export interface RosterEntry {
  id: string;
  name: string;
  arrivesAt: string;
  departsAt: string;
  label: string;
}

export function sortRosterEntries(
  session: SessionWithParticipants,
  status: ParticipantStatus
): RosterEntry[] {
  return session.participants
    .filter((participant) => participant.status === status && participant.user?.name)
    .map((participant) => {
      const window = getParticipantWindow(session, participant);
      const name = participant.user?.name as string;

      return {
        id: participant.id,
        name,
        arrivesAt: window.arrivesAt,
        departsAt: window.departsAt,
        label: `${name} (${formatTimeValue(window.arrivesAt)}-${formatTimeValue(window.departsAt)})`
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildConfirmedSlotCounts(session: SessionWithParticipants): SlotCount[] {
  const bounds = getSessionBounds(session);
  const windows = session.participants
    .filter((participant) => participant.status === 'confirmed')
    .map((participant) => getParticipantWindow(session, participant));

  return buildSlotCounts(windows, bounds);
}

export function getPeakConfirmedWindow(session: SessionWithParticipants): (TimeRange & { count: number }) | null {
  return findPeakWindow(buildConfirmedSlotCounts(session));
}

export function getConfirmedRangeAtOrAbove(
  session: SessionWithParticipants,
  threshold: number
): TimeRange | null {
  return findRangeAtOrAbove(buildConfirmedSlotCounts(session), threshold);
}

export async function fetchTodaySessions(
  supabase: SupabaseClient<Database>
): Promise<SessionWithParticipants[]> {
  const start = formatISO(startOfDay(new Date()));
  const end = formatISO(addDays(startOfDay(new Date()), 1));

  const { data, error } = await supabase
    .from('sessions')
    .select(sessionSelect)
    .gte('starts_at', start)
    .lt('starts_at', end)
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapSession);
}

export async function fetchSessionById(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<SessionWithParticipants | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(sessionSelect)
    .eq('id', sessionId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data ? mapSession(data) : null;
}

export async function fetchSessionByCode(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<SessionWithParticipants | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(sessionSelect)
    .eq('code', code.toUpperCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data ? mapSession(data) : null;
}

export async function createSession(
  supabase: SupabaseClient<Database>,
  payload: {
    startsAt: string;
    endsAt: string;
    note?: string;
    capacity?: number | null;
    court?: string;
    createdBy: string;
  }
): Promise<Session> {
  let created: Session | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        code: makeCode(),
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        note: payload.note?.trim() || null,
        capacity: payload.capacity ?? null,
        court: payload.court?.trim() || null,
        created_by: payload.createdBy,
        venue: 'Bay Padel'
      })
      .select('*')
      .single();

    if (!error && data) {
      created = data as Session;
      break;
    }

    if (error?.code !== '23505') {
      throw new Error(error?.message ?? 'Failed to create session.');
    }
  }

  if (!created) {
    throw new Error('Could not generate a unique session code.');
  }

  const initialWindow = sessionBoundsFromIso(created.starts_at, created.ends_at);
  const { error: participantError } = await supabase.from('participants').insert({
    session_id: created.id,
    user_id: payload.createdBy,
    status: 'confirmed',
    arrives_at: initialWindow.arrivesAt,
    departs_at: initialWindow.departsAt
  });

  if (participantError) {
    throw new Error(participantError.message);
  }

  return created;
}

export async function updateParticipation(
  supabase: SupabaseClient<Database>,
  payload: {
    sessionId: string;
    userId: string;
    status: ParticipantStatus;
    arrivesAt?: string;
    departsAt?: string;
  }
): Promise<void> {
  const row: Database['public']['Tables']['participants']['Insert'] = {
    session_id: payload.sessionId,
    user_id: payload.userId,
    status: payload.status
  };

  if (payload.arrivesAt !== undefined) {
    row.arrives_at = payload.arrivesAt;
  }

  if (payload.departsAt !== undefined) {
    row.departs_at = payload.departsAt;
  }

  const { error } = await supabase.from('participants').upsert(row, {
    onConflict: 'session_id,user_id'
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function dropParticipation(
  supabase: SupabaseClient<Database>,
  payload: {
    sessionId: string;
    userId: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('session_id', payload.sessionId)
    .eq('user_id', payload.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function formatSessionTime(startsAt: string, endsAt?: string | null): string {
  const startDate = parseIsoDate(startsAt);
  if (!startDate) {
    return 'Time TBD';
  }

  const endDate = parseIsoDate(endsAt) ?? addHours(startDate, 2);
  const dayLabel = isToday(startDate) ? 'Today' : format(startDate, 'EEE');
  return `${dayLabel} ${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
}

export function summarizeCounts(session: SessionWithParticipants): string {
  const confirmed = session.participants.filter((p) => p.status === 'confirmed').length;
  const maybe = session.participants.filter((p) => p.status === 'maybe').length;
  const confirmedLabel = session.capacity ? `${confirmed}/${session.capacity} confirmed` : `${confirmed} confirmed`;
  return `${confirmedLabel}${maybe ? ` • ${maybe} maybe` : ''}`;
}

export function sortRosterNames(session: SessionWithParticipants, status: ParticipantStatus): string[] {
  return session.participants
    .filter((p) => p.status === status && p.user?.name)
    .map((p) => p.user?.name as string)
    .sort((a, b) => a.localeCompare(b));
}

export function isPastSession(startsAt: string): boolean {
  return parseISO(startsAt) < endOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
}
