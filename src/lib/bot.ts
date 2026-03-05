import {
  addDays,
  addHours,
  set,
  startOfDay,
  subHours
} from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchAvailabilityWindowsForDate,
  summarizeAvailabilityPeak,
  toDateString,
  upsertAvailabilityWindow
} from '@/lib/availability-windows';
import { normalizePhone } from '@/lib/identity';
import {
  createSession,
  dropParticipation,
  fetchSessionByCode,
  fetchSessionById,
  formatSessionTime,
  getConfirmedRangeAtOrAbove,
  getParticipantWindow,
  getSessionBounds,
  sortRosterNames,
  summarizeCounts,
  updateParticipation
} from '@/lib/sessions';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { clampWindowToBounds, formatTimeRange } from '@/lib/time-windows';
import type { AppUser, Database, SessionWithParticipants } from '@/lib/types';

const QUORUM_THRESHOLDS = [4, 8, 12] as const;
const DEFAULT_SESSION_NOTE = 'Open play at Bay Padel';

type ParsedCommand =
  | {
      type: 'create';
      startsAt: string;
      endsAt: string;
    }
  | {
      type: 'create_missing_time';
    }
  | {
      type: 'join';
      code?: string;
      arrivesAt?: string;
      departsAt?: string;
    }
  | {
      type: 'maybe';
      code?: string;
      arrivesAt?: string;
      departsAt?: string;
    }
  | {
      type: 'drop';
      code?: string;
    }
  | {
      type: 'available';
      arrivesAt: string;
      departsAt: string;
    }
  | {
      type: 'available_missing_time';
    }
  | {
      type: 'status';
    }
  | {
      type: 'cancel';
      code?: string;
    }
  | {
      type: 'name';
      name: string;
    }
  | {
      type: 'name_missing';
    }
  | {
      type: 'help';
    }
  | {
      type: 'unknown';
    };

export interface BotCommandInput {
  from: string;
  message: string;
  profileName?: string;
  siteUrl: string;
  replyTo?: string;
}

export interface BotOutboundMessage {
  to: string;
  body: string;
}

export interface BotCommandResult {
  reply: string;
  notifications: BotOutboundMessage[];
}

type BotUser = Pick<AppUser, 'id' | 'name' | 'phone'>;

type TimeWindow = {
  arrivesAt: string;
  departsAt: string;
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function isNameValid(name: string): boolean {
  if (name.length < 2 || name.length > 60) {
    return false;
  }

  return /^[a-zA-Z][a-zA-Z .'-]+$/.test(name);
}

function isPlaceholderName(name: string): boolean {
  const normalized = normalizeText(name);
  return normalized.startsWith('whatsapp player') || normalized.startsWith('new player');
}

function helpMessage(): string {
  return [
    'Try one of these commands:',
    'create 6pm-8pm',
    'available 5-9pm',
    'join ABC123',
    'join 6-8pm ABC123',
    'maybe ABC123',
    'drop ABC123',
    "status (or who's in?)",
    'cancel ABC123',
    'name Your Name'
  ].join('\n');
}

function joinLink(siteUrl: string, code: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/join?code=${code}`;
}

function extractSessionCode(text: string): string | undefined {
  const matches = text.toUpperCase().match(/\b[A-Z0-9]{6}\b/g);
  return matches?.[0];
}

function normalizeMeridiem(value?: string | null): 'am' | 'pm' | null {
  if (!value) {
    return null;
  }

  return value.startsWith('a') ? 'am' : 'pm';
}

function to24Hour(hour: number, meridiem: 'am' | 'pm'): number {
  if (hour < 1 || hour > 12) {
    throw new Error('Invalid hour.');
  }

  if (meridiem === 'am') {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

function toTimeValue(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
}

function parseTimeWindow(message: string): TimeWindow | null {
  try {
    const rangeMatch = message.match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?/
    );

    if (!rangeMatch) {
      return null;
    }

    const hasMorningHint = /\bmorning\b/.test(message);
    const defaultMeridiem: 'am' | 'pm' = hasMorningHint ? 'am' : 'pm';

    const startHour = Number(rangeMatch[1]);
    const startMinute = Number(rangeMatch[2] ?? '0');
    const startMeridiemRaw = normalizeMeridiem(rangeMatch[3]);
    const endHour = Number(rangeMatch[4]);
    const endMinute = Number(rangeMatch[5] ?? '0');
    const endMeridiemRaw = normalizeMeridiem(rangeMatch[6]);

    if (startMinute > 59 || endMinute > 59) {
      return null;
    }

    const startMeridiem = startMeridiemRaw ?? endMeridiemRaw ?? defaultMeridiem;
    const endMeridiem = endMeridiemRaw ?? startMeridiem;

    const startMinutes = to24Hour(startHour, startMeridiem) * 60 + startMinute;
    let endMinutes = to24Hour(endHour, endMeridiem) * 60 + endMinute;

    for (let attempt = 0; attempt < 2 && endMinutes <= startMinutes; attempt += 1) {
      endMinutes += 12 * 60;
    }

    if (endMinutes <= startMinutes || endMinutes > 24 * 60) {
      return null;
    }

    return {
      arrivesAt: toTimeValue(startMinutes),
      departsAt: toTimeValue(endMinutes)
    };
  } catch {
    return null;
  }
}

function parseCreateTimes(message: string, now: Date): { startsAt: string; endsAt: string } | null {
  try {
    const rangeMatch = message.match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?/
    );

    const singleMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?/);

    if (!rangeMatch && !singleMatch) {
      return null;
    }

    const hasMorningHint = /\bmorning\b/.test(message);
    const hasTomorrowHint = /\btomorrow\b/.test(message);
    const hasTodayHint = /\b(today|tonight)\b/.test(message);
    const defaultMeridiem: 'am' | 'pm' = hasMorningHint ? 'am' : 'pm';

    let baseDate = startOfDay(now);
    if (hasTomorrowHint) {
      baseDate = addDays(baseDate, 1);
    }

    if (rangeMatch) {
      const startHour = Number(rangeMatch[1]);
      const startMinute = Number(rangeMatch[2] ?? '0');
      const startMeridiemRaw = normalizeMeridiem(rangeMatch[3]);
      const endHour = Number(rangeMatch[4]);
      const endMinute = Number(rangeMatch[5] ?? '0');
      const endMeridiemRaw = normalizeMeridiem(rangeMatch[6]);

      if (startMinute > 59 || endMinute > 59) {
        return null;
      }

      const startMeridiem = startMeridiemRaw ?? endMeridiemRaw ?? defaultMeridiem;
      const endMeridiem = endMeridiemRaw ?? startMeridiem;

      let startsAt = set(baseDate, {
        hours: to24Hour(startHour, startMeridiem),
        minutes: startMinute,
        seconds: 0,
        milliseconds: 0
      });

      if (!hasTomorrowHint && !hasTodayHint && startsAt < subHours(now, 1)) {
        startsAt = addDays(startsAt, 1);
      }

      let endsAt = set(startOfDay(startsAt), {
        hours: to24Hour(endHour, endMeridiem),
        minutes: endMinute,
        seconds: 0,
        milliseconds: 0
      });

      for (let attempt = 0; attempt < 2 && endsAt <= startsAt; attempt += 1) {
        endsAt = addHours(endsAt, 12);
      }

      if (endsAt <= startsAt) {
        endsAt = addDays(endsAt, 1);
      }

      return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      };
    }

    if (!singleMatch) {
      return null;
    }

    const hour = Number(singleMatch[1]);
    const minute = Number(singleMatch[2] ?? '0');

    if (minute > 59) {
      return null;
    }

    const meridiem = normalizeMeridiem(singleMatch[3]) ?? defaultMeridiem;
    let startsAt = set(baseDate, {
      hours: to24Hour(hour, meridiem),
      minutes: minute,
      seconds: 0,
      milliseconds: 0
    });

    if (!hasTomorrowHint && !hasTodayHint && startsAt < subHours(now, 1)) {
      startsAt = addDays(startsAt, 1);
    }

    const endsAt = addHours(startsAt, 2);

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    };
  } catch {
    return null;
  }
}

function parseCommand(text: string): ParsedCommand {
  const normalized = normalizeText(text);
  const code = extractSessionCode(text);

  const nameMatch = normalized.match(/^(?:name|my name is)\s*(.*)$/);
  if (nameMatch) {
    const name = normalizeName(nameMatch[1] ?? '');
    if (!name) {
      return {
        type: 'name_missing'
      };
    }

    return {
      type: 'name',
      name
    };
  }

  if (/^(?:help|\?)$/.test(normalized) || normalized.includes('what can you do')) {
    return {
      type: 'help'
    };
  }

  if (/\b(status|who'?s in|roster|list sessions?)\b/.test(normalized)) {
    return {
      type: 'status'
    };
  }

  if (/^(?:available|avail|i'?m available|i am available|around)\b/.test(normalized)) {
    const parsedWindow = parseTimeWindow(normalized);
    if (!parsedWindow) {
      return {
        type: 'available_missing_time'
      };
    }

    return {
      type: 'available',
      arrivesAt: parsedWindow.arrivesAt,
      departsAt: parsedWindow.departsAt
    };
  }

  if (/\b(create|new session|new game|start session)\b/.test(normalized)) {
    const parsedTimes = parseCreateTimes(normalized, new Date());
    if (!parsedTimes) {
      return {
        type: 'create_missing_time'
      };
    }

    return {
      type: 'create',
      startsAt: parsedTimes.startsAt,
      endsAt: parsedTimes.endsAt
    };
  }

  if (/\bcancel\b/.test(normalized)) {
    return {
      type: 'cancel',
      code
    };
  }

  if (/\bmaybe\b|\bmight\b|\bnot sure\b/.test(normalized)) {
    const parsedWindow = parseTimeWindow(normalized);
    return {
      type: 'maybe',
      code,
      arrivesAt: parsedWindow?.arrivesAt,
      departsAt: parsedWindow?.departsAt
    };
  }

  if (/\bdrop\b|can't make it|cant make it|cannot make it|\bout\b|not coming/.test(normalized)) {
    return {
      type: 'drop',
      code
    };
  }

  if (/\bjoin\b|\bi'?m in\b|\bi am in\b|count me in|\byes\b|\byep\b|\bcoming\b/.test(normalized)) {
    const parsedWindow = parseTimeWindow(normalized);
    return {
      type: 'join',
      code,
      arrivesAt: parsedWindow?.arrivesAt,
      departsAt: parsedWindow?.departsAt
    };
  }

  return {
    type: 'unknown'
  };
}

function maybeExtractBareName(text: string): string | null {
  const cleaned = normalizeName(text);

  if (!isNameValid(cleaned)) {
    return null;
  }

  const normalized = normalizeText(cleaned);
  if (/\b(create|join|maybe|drop|status|cancel|help|available)\b/.test(normalized)) {
    return null;
  }

  return cleaned;
}

async function ensureUserForPhone(
  supabase: SupabaseClient<Database>,
  phone: string,
  profileName?: string
): Promise<{ user: BotUser; isNew: boolean; shouldPromptForName: boolean }> {
  const { data: existing, error } = await supabase
    .from('users')
    .select('id,name,phone')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (existing) {
    return {
      user: existing,
      isNew: false,
      shouldPromptForName: isPlaceholderName(existing.name)
    };
  }

  const cleanProfileName = normalizeName(profileName ?? '');
  const seededName = cleanProfileName.length >= 2 ? cleanProfileName : `WhatsApp Player ${phone.slice(-4)}`;

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({
      phone,
      name: seededName
    })
    .select('id,name,phone')
    .single();

  if (createError || !created) {
    throw new Error(createError?.message ?? 'Could not register this phone number.');
  }

  return {
    user: created,
    isNew: true,
    shouldPromptForName: true
  };
}

async function updateUserName(
  supabase: SupabaseClient<Database>,
  userId: string,
  name: string
): Promise<BotUser> {
  const { data, error } = await supabase
    .from('users')
    .update({
      name
    })
    .eq('id', userId)
    .select('id,name,phone')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not update your name.');
  }

  return data;
}

async function resolveTargetSession(
  supabase: SupabaseClient<Database>,
  code?: string
): Promise<SessionWithParticipants | null> {
  if (code) {
    return fetchSessionByCode(supabase, code.toUpperCase());
  }

  const nowIso = new Date().toISOString();
  const { data: upcoming, error: upcomingError } = await supabase
    .from('sessions')
    .select('id')
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcomingError) {
    throw new Error(upcomingError.message);
  }

  if (upcoming?.id) {
    return fetchSessionById(supabase, upcoming.id);
  }

  const recentFloor = addDays(new Date(), -1).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from('sessions')
    .select('id')
    .gte('starts_at', recentFloor)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentError) {
    throw new Error(recentError.message);
  }

  if (!recent?.id) {
    return null;
  }

  return fetchSessionById(supabase, recent.id);
}

async function fetchUpcomingSessions(supabase: SupabaseClient<Database>): Promise<SessionWithParticipants[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(3);

  if (error) {
    throw new Error(error.message);
  }

  const sessions = await Promise.all((data ?? []).map((item) => fetchSessionById(supabase, item.id)));
  return sessions.filter((session): session is SessionWithParticipants => Boolean(session));
}

function countConfirmed(session: SessionWithParticipants): number {
  return session.participants.filter((participant) => participant.status === 'confirmed').length;
}

function formatThresholdWindow(session: SessionWithParticipants, threshold: number): string {
  const thresholdRange = getConfirmedRangeAtOrAbove(session, threshold);

  if (thresholdRange) {
    return formatTimeRange(thresholdRange.start, thresholdRange.end);
  }

  const sessionBounds = getSessionBounds(session);
  return formatTimeRange(sessionBounds.arrivesAt, sessionBounds.departsAt);
}

function buildQuorumMessages(
  session: SessionWithParticipants,
  beforeConfirmed: number,
  afterConfirmed: number
): string[] {
  const messages: string[] = [];

  for (const threshold of QUORUM_THRESHOLDS) {
    if (beforeConfirmed >= threshold || afterConfirmed < threshold) {
      continue;
    }

    const timeWindow = formatThresholdWindow(session, threshold);

    if (threshold === 4) {
      messages.push(`🏓 4 players available ${timeWindow}! Game on!`);
      continue;
    }

    if (threshold === 8) {
      messages.push(`🏓 8 players available ${timeWindow}!`);
      continue;
    }

    messages.push(`🏓 12 players available ${timeWindow}!`);
  }

  return messages;
}

async function getConfirmedCount(supabase: SupabaseClient<Database>, sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('participants')
    .select('id', { head: true, count: 'exact' })
    .eq('session_id', sessionId)
    .eq('status', 'confirmed');

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function noUpcomingSessionsMessage(): string {
  return 'No upcoming sessions found. Create one with: create 6pm-8pm';
}

function sessionNotFoundMessage(code?: string): string {
  if (code) {
    return `Session ${code.toUpperCase()} was not found. Use status to list active sessions.`;
  }

  return noUpcomingSessionsMessage();
}

function formatStatusMessage(
  sessions: SessionWithParticipants[],
  availability: {
    count: number;
    peak: {
      start: string;
      end: string;
      count: number;
    } | null;
  }
): string {
  const lines: string[] = [
    `Today's availability windows: ${availability.count}`,
    availability.peak
      ? `Peak overlap: ${formatTimeRange(availability.peak.start, availability.peak.end)} (${availability.peak.count} people)`
      : 'Peak overlap: none yet',
    ''
  ];

  if (!sessions.length) {
    lines.push(noUpcomingSessionsMessage());
    return lines.join('\n');
  }

  lines.push('Upcoming sessions:');

  for (const session of sessions) {
    const confirmedNames = sortRosterNames(session, 'confirmed');
    const maybeNames = sortRosterNames(session, 'maybe');

    lines.push(`${session.code} • ${formatSessionTime(session.starts_at, session.ends_at)} • ${summarizeCounts(session)}`);
    lines.push(`In: ${confirmedNames.length ? confirmedNames.join(', ') : 'No one yet'}`);

    if (maybeNames.length) {
      lines.push(`Maybe: ${maybeNames.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function maybeWithNamePrompt(
  text: string,
  opts: {
    isNew: boolean;
    shouldPromptForName: boolean;
  }
): string {
  if (opts.isNew) {
    return `${text}\n\nWelcome to Bay Padel. Reply with: name Your Name`;
  }

  if (opts.shouldPromptForName) {
    return `${text}\n\nReply with: name Your Name so people recognize you in the roster.`;
  }

  return text;
}

export async function handleBotCommand(input: BotCommandInput): Promise<BotCommandResult> {
  const supabase = getSupabaseServerClient();

  const normalizedPhone = normalizePhone(input.from);
  if (!normalizedPhone) {
    return {
      reply: 'I could not read your phone number. Please send from a valid WhatsApp number.',
      notifications: []
    };
  }

  const userState = await ensureUserForPhone(supabase, normalizedPhone, input.profileName);
  let user = userState.user;
  const command = parseCommand(input.message);

  if (command.type === 'help') {
    return {
      reply: maybeWithNamePrompt(helpMessage(), userState),
      notifications: []
    };
  }

  if (command.type === 'name_missing') {
    return {
      reply: 'Please send your name like this: name Alex',
      notifications: []
    };
  }

  if (command.type === 'name') {
    const cleanName = normalizeName(command.name);
    if (!isNameValid(cleanName)) {
      return {
        reply: 'Please send a valid name (letters, spaces, apostrophes, periods, hyphens).',
        notifications: []
      };
    }

    user = await updateUserName(supabase, user.id, cleanName);

    return {
      reply: `Thanks, ${user.name}. You are all set.`,
      notifications: []
    };
  }

  if (command.type === 'unknown' && userState.shouldPromptForName) {
    const nameGuess = maybeExtractBareName(input.message);

    if (nameGuess) {
      user = await updateUserName(supabase, user.id, nameGuess);
      return {
        reply: `Thanks, ${user.name}. You are all set.`,
        notifications: []
      };
    }
  }

  if (command.type === 'create_missing_time') {
    return {
      reply: maybeWithNamePrompt('Please include a time range, for example: create 6pm-8pm', userState),
      notifications: []
    };
  }

  if (command.type === 'available_missing_time') {
    return {
      reply: maybeWithNamePrompt('Please include a time range, for example: available 5-9pm', userState),
      notifications: []
    };
  }

  if (command.type === 'create') {
    const createdSession = await createSession(supabase, {
      startsAt: command.startsAt,
      endsAt: command.endsAt,
      note: DEFAULT_SESSION_NOTE,
      createdBy: user.id
    });

    const link = joinLink(input.siteUrl, createdSession.code);
    const reply = [
      `Created session ${createdSession.code}.`,
      `${formatSessionTime(createdSession.starts_at, createdSession.ends_at)}`,
      `Join link: ${link}`
    ].join('\n');

    return {
      reply: maybeWithNamePrompt(reply, userState),
      notifications: []
    };
  }

  if (command.type === 'available') {
    await upsertAvailabilityWindow(supabase, {
      userId: user.id,
      date: toDateString(),
      arrivesAt: command.arrivesAt,
      departsAt: command.departsAt
    });

    const windows = await fetchAvailabilityWindowsForDate(supabase, toDateString());
    const peak = summarizeAvailabilityPeak(windows);

    const lines = [
      `Saved for today: ${formatTimeRange(command.arrivesAt, command.departsAt)}.`,
      `People available today: ${windows.length}`
    ];

    if (peak) {
      lines.push(`Peak overlap: ${formatTimeRange(peak.start, peak.end)} (${peak.count} people)`);
    }

    return {
      reply: maybeWithNamePrompt(lines.join('\n'), userState),
      notifications: []
    };
  }

  if (command.type === 'status') {
    const [sessions, windows] = await Promise.all([
      fetchUpcomingSessions(supabase),
      fetchAvailabilityWindowsForDate(supabase, toDateString())
    ]);

    return {
      reply: maybeWithNamePrompt(
        formatStatusMessage(sessions, {
          count: windows.length,
          peak: summarizeAvailabilityPeak(windows)
        }),
        userState
      ),
      notifications: []
    };
  }

  if (command.type === 'cancel') {
    const targetSession = await resolveTargetSession(supabase, command.code);

    if (!targetSession) {
      return {
        reply: maybeWithNamePrompt(sessionNotFoundMessage(command.code), userState),
        notifications: []
      };
    }

    if (targetSession.created_by !== user.id) {
      return {
        reply: maybeWithNamePrompt(
          `Only the session creator can cancel ${targetSession.code}.`,
          userState
        ),
        notifications: []
      };
    }

    const { error } = await supabase.from('sessions').delete().eq('id', targetSession.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      reply: maybeWithNamePrompt(`Session ${targetSession.code} has been cancelled.`, userState),
      notifications: []
    };
  }

  if (command.type === 'join' || command.type === 'maybe' || command.type === 'drop') {
    const targetSession = await resolveTargetSession(supabase, command.code);

    if (!targetSession) {
      return {
        reply: maybeWithNamePrompt(sessionNotFoundMessage(command.code), userState),
        notifications: []
      };
    }

    const existingParticipation = targetSession.participants.find((participant) => participant.user_id === user.id);

    if (
      command.type === 'join' &&
      existingParticipation?.status === 'confirmed' &&
      (!command.arrivesAt || !command.departsAt)
    ) {
      return {
        reply: maybeWithNamePrompt(`You are already confirmed for ${targetSession.code}.`, userState),
        notifications: []
      };
    }

    if (
      command.type === 'maybe' &&
      existingParticipation?.status === 'maybe' &&
      (!command.arrivesAt || !command.departsAt)
    ) {
      return {
        reply: maybeWithNamePrompt(`You are already marked maybe for ${targetSession.code}.`, userState),
        notifications: []
      };
    }

    if (command.type === 'drop' && !existingParticipation) {
      return {
        reply: maybeWithNamePrompt(`You are not in ${targetSession.code}.`, userState),
        notifications: []
      };
    }

    const beforeConfirmed = await getConfirmedCount(supabase, targetSession.id);

    if (command.type === 'drop') {
      await dropParticipation(supabase, {
        sessionId: targetSession.id,
        userId: user.id
      });
    }

    if (command.type === 'join' || command.type === 'maybe') {
      const sessionBounds = getSessionBounds(targetSession);
      const providedWindow =
        command.arrivesAt && command.departsAt
          ? {
              arrivesAt: command.arrivesAt,
              departsAt: command.departsAt
            }
          : null;

      const participationWindow = providedWindow
        ? clampWindowToBounds(providedWindow, sessionBounds)
        : sessionBounds;

      if (!participationWindow) {
        return {
          reply: maybeWithNamePrompt(
            `Your time window needs to overlap ${formatTimeRange(sessionBounds.arrivesAt, sessionBounds.departsAt)}.`,
            userState
          ),
          notifications: []
        };
      }

      await updateParticipation(supabase, {
        sessionId: targetSession.id,
        userId: user.id,
        status: command.type === 'join' ? 'confirmed' : 'maybe',
        arrivesAt: participationWindow.arrivesAt,
        departsAt: participationWindow.departsAt
      });
    }

    const refreshedSession = await fetchSessionById(supabase, targetSession.id);

    if (!refreshedSession) {
      return {
        reply: maybeWithNamePrompt('Session updated, but it is no longer available.', userState),
        notifications: []
      };
    }

    const afterConfirmed = countConfirmed(refreshedSession);
    const quorumMessages = buildQuorumMessages(refreshedSession, beforeConfirmed, afterConfirmed);
    const replyTo = input.replyTo ?? input.from;

    if (command.type === 'drop') {
      return {
        reply: maybeWithNamePrompt(
          `Dropped from ${refreshedSession.code}.\n${summarizeCounts(refreshedSession)}`,
          userState
        ),
        notifications: []
      };
    }

    const refreshedParticipant = refreshedSession.participants.find((participant) => participant.user_id === user.id);
    const participantWindow =
      refreshedParticipant && (command.type === 'join' || command.type === 'maybe')
        ? getParticipantWindow(refreshedSession, refreshedParticipant)
        : null;
    const fallbackBounds = getSessionBounds(refreshedSession);
    const windowLabel = participantWindow
      ? formatTimeRange(participantWindow.arrivesAt, participantWindow.departsAt)
      : formatTimeRange(fallbackBounds.arrivesAt, fallbackBounds.departsAt);

    const verb = command.type === 'join' ? 'You are in' : 'Marked as maybe';

    return {
      reply: maybeWithNamePrompt(
        `${verb} for ${refreshedSession.code} (${formatSessionTime(
          refreshedSession.starts_at,
          refreshedSession.ends_at
        )}).\nWindow: ${windowLabel}\n${summarizeCounts(refreshedSession)}`,
        userState
      ),
      notifications: quorumMessages.map((body) => ({
        to: replyTo,
        body
      }))
    };
  }

  return {
    reply: maybeWithNamePrompt(`I did not understand that.\n\n${helpMessage()}`, userState),
    notifications: []
  };
}
