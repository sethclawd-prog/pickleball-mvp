import {
  addDays,
  endOfDay,
  format,
  formatISO,
  isToday,
  parseISO,
  startOfDay
} from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Database,
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
    created_at,
    updated_at,
    users (
      id,
      name,
      phone
    )
  )
`;

function mapSession(raw: any): SessionWithParticipants {
  const participants = (raw.participants ?? []).map((participant: any) => ({
    id: participant.id,
    session_id: participant.session_id,
    user_id: participant.user_id,
    status: participant.status,
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
    ends_at: raw.ends_at,
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

  const { error: participantError } = await supabase.from('participants').insert({
    session_id: created.id,
    user_id: payload.createdBy,
    status: 'confirmed'
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
  }
): Promise<void> {
  const { error } = await supabase.from('participants').upsert(
    {
      session_id: payload.sessionId,
      user_id: payload.userId,
      status: payload.status
    },
    {
      onConflict: 'session_id,user_id'
    }
  );

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

export function formatSessionTime(startsAt: string, endsAt: string): string {
  const startDate = parseISO(startsAt);
  const endDate = parseISO(endsAt);
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
