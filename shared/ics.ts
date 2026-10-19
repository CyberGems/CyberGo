import { buildSchedule, nextDate, parseLocal } from './schedule';
import type { Freq, ItemDraft, Recurrence } from './types';

export interface IcsEvent {
  draft: ItemDraft;
  /** The position of the event in the file, so an error points at it. */
  number: number;
}

/**
 * Result of an ICS import. A file with one broken event still gives the
 * events that could be read, and every rejected event adds one short message
 * to errors.
 */
export interface IcsParseResult {
  events: IcsEvent[];
  errors: string[];
}

/** Unfold RFC 5545 lines: continuation lines start with a space or tab. */
function unfold(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else if (line.trim() !== '') {
      out.push(line);
    }
  }
  return out;
}

/**
 * Decodes the escaped text of RFC 5545 in a single pass, so a literal
 * backslash before an n is not read as a line break.
 */
function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_match, escaped: string) => {
    if (escaped === 'n' || escaped === 'N') return '\n';
    if (escaped === '\\') return '\\';
    return escaped;
  });
}

interface Prop {
  name: string;
  params: string;
  value: string;
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = head.indexOf(';');
  if (semi < 0) return { name: head.toUpperCase(), params: '', value };
  return { name: head.slice(0, semi).toUpperCase(), params: head.slice(semi + 1).toUpperCase(), value };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Reads the TZID parameter of a property. */
function extractTzid(params: string): string | null {
  const match = /TZID=([^;]+)/.exec(params);
  if (!match) return null;
  const value = match[1].trim().replace(/^"(.*)"$/, '$1').trim();
  return value || null;
}

/** Offset of a named time zone at the given instant, in milliseconds. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - instant;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Turns the wall clock of a named zone into the matching instant. An unknown
 * zone gives null, the caller then keeps the time as local.
 */
function zonedToDate(wall: WallClock, timeZone: string): Date | null {
  try {
    const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    const offset = zoneOffsetMs(guess, timeZone);
    let instant = guess - offset;
    const refined = zoneOffsetMs(instant, timeZone);
    if (refined !== offset) instant = guess - refined;
    return new Date(instant);
  } catch {
    return null;
  }
}

/** Parses an ICS date value into a Date plus whether it is a whole day. */
function parseIcsDate(
  value: string,
  timeZone?: string | null,
  label = 'date',
): { date: Date; allDay: boolean } {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(d), 9, 0, 0, 0), allDay: true };
  }
  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(v);
  if (!stamp) throw new Error(`invalid ${label}`);
  const [, y, m, d, hh, mm, ss, z] = stamp;
  if (z) {
    return {
      date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0'))),
      allDay: false,
    };
  }
  const wall: WallClock = {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
    second: Number(ss || '0'),
  };
  if (timeZone) {
    const zoned = zonedToDate(wall, timeZone);
    if (zoned) return { date: zoned, allDay: false };
  }
  return {
    date: new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second),
    allDay: false,
  };
}

function formatLocal(date: Date, allDay: boolean): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (allDay) return day;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function asFreq(value: string): Freq | null {
  const v = value.trim().toUpperCase();
  if (v === 'DAILY' || v === 'WEEKLY' || v === 'MONTHLY' || v === 'YEARLY') return v.toLowerCase() as Freq;
  return null;
}

/**
 * Reads the end of a recurrence. A UTC value keeps its UTC calendar day, a
 * local value keeps the local one, so a series never runs one day too long.
 */
function parseUntil(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    if (/^\d{8}$/.test(v)) {
      return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    }
    const { date } = parseIcsDate(v, null, 'UNTIL');
    if (/Z$/i.test(v)) {
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } catch {
    return null;
  }
}

/** Parses an ISO 8601 duration such as PT1H30M or P2W. */
function parseDuration(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const weeks = Number(match[2] ?? '0');
  const days = Number(match[3] ?? '0');
  const hours = Number(match[4] ?? '0');
  const minutes = Number(match[5] ?? '0');
  const seconds = Number(match[6] ?? '0');
  if (!weeks && !days && !hours && !minutes && !seconds) return null;
  const total = (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds;
  return sign * total * 1000;
}

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Reads the weekdays of a BYDAY part, the ordinal prefix is ignored. */
function parseByDay(rrule: string): number[] {
  const raw = /BYDAY=([^;]+)/i.exec(rrule)?.[1];
  if (!raw) return [];
  const days: number[] = [];
  for (const part of raw.split(',')) {
    const match = /([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)/i.exec(part.trim());
    if (!match) continue;
    const day = WEEKDAYS[match[2].toUpperCase()];
    if (!days.includes(day)) days.push(day);
  }
  return days;
}

/** Reads the calendar day of a BYMONTHDAY part. */
function parseByMonthDay(rrule: string): number | null {
  const raw = /BYMONTHDAY=([^;]+)/i.exec(rrule)?.[1];
  if (!raw) return null;
  for (const part of raw.split(',')) {
    const value = Number(part.trim());
    if (Number.isInteger(value) && value >= 1 && value <= 31) return value;
  }
  return null;
}

/**
 * Projects the series forward to the last occurrence of a counted rule and
 * returns that day, so a rule with COUNT does not become an endless series.
 */
function countUntil(start: Date, freq: Freq, interval: number, count: number, dayOfMonth: number | null): string {
  const recurrence: Recurrence = { freq, interval, until: null, dayOfMonth };
  let current = new Date(start.getTime());
  for (let index = 1; index < count; index += 1) {
    const next = nextDate(current, recurrence);
    if (!next) break;
    current = next;
  }
  return `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`;
}

function parseTriggerMinutes(value: string): number | null {
  const match = /^-PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const minutes = (Number(match[1] || 0) * 60) + Number(match[2] || 0) + Math.round(Number(match[3] || 0) / 60);
  return minutes > 0 ? minutes : null;
}

function buildDraft(props: Prop[], index: number, errors: string[]): ItemDraft {
  const get = (name: string): Prop | undefined => props.find((p) => p.name === name);
  const title = unescapeText(get('SUMMARY')?.value ?? '').trim();
  if (!title) throw new Error('missing SUMMARY');
  const startProp = get('DTSTART');
  if (!startProp) throw new Error('missing DTSTART');

  const rrule = get('RRULE')?.value ?? '';
  const freq = asFreq(/FREQ=([A-Za-z]+)/.exec(rrule)?.[1] ?? '');
  const interval = Math.max(1, Number(/INTERVAL=(\d+)/.exec(rrule)?.[1] || '1') || 1);
  const byDay = parseByDay(rrule);
  const byMonthDay = parseByMonthDay(rrule);
  const untilRaw = /UNTIL=([^;]+)/i.exec(rrule)?.[1] ?? '';
  const count = Number(/COUNT=(\d+)/i.exec(rrule)?.[1] ?? '0') || 0;

  const startParsed = parseIcsDate(startProp.value, extractTzid(startProp.params), 'DTSTART date');
  const start = startParsed.date;
  const declaredAllDay = startProp.params.includes('VALUE=DATE') || startParsed.allDay;

  // A weekly rule names the weekday it repeats on. The model keeps a single
  // weekday, so the start moves onto the first weekday named by BYDAY.
  let dayShift = 0;
  if (freq === 'weekly' && byDay.length) {
    if (byDay.length > 1) {
      errors.push(`event ${index + 1}: BYDAY names ${byDay.length} weekdays, only the first one was kept`);
    }
    const current = start.getDay();
    if (current !== byDay[0]) dayShift = (byDay[0] - current + 7) % 7;
  }
  if (dayShift) start.setDate(start.getDate() + dayShift);

  const endProp = get('DTEND');
  let end: Date | null = null;
  if (endProp) {
    try {
      end = parseIcsDate(endProp.value, extractTzid(endProp.params), 'DTEND date').date;
    } catch {
      end = null;
    }
    if (end && dayShift) end.setDate(end.getDate() + dayShift);
  }

  let endLocal: string | null = null;
  if (end) {
    if (declaredAllDay) {
      // The end of an all day event is exclusive, the last day is the day before.
      const last = new Date(end);
      last.setDate(last.getDate() - 1);
      if (last > start) endLocal = formatLocal(last, true);
    } else if (end.getTime() >= start.getTime()) {
      endLocal = formatLocal(end, false);
    } else {
      throw new Error('end before start');
    }
  } else {
    // DURATION is the alternative to DTEND, DTEND wins when both are present.
    const durationProp = get('DURATION');
    const duration = durationProp ? parseDuration(durationProp.value) : null;
    if (duration !== null && duration > 0) {
      if (declaredAllDay) {
        const days = Math.floor(duration / 86_400_000);
        if (days > 0) {
          const exclusive = new Date(start);
          exclusive.setDate(exclusive.getDate() + days);
          const last = new Date(exclusive);
          last.setDate(last.getDate() - 1);
          if (last > start) endLocal = formatLocal(last, true);
        }
      } else {
        const finish = new Date(start.getTime() + duration);
        if (finish.getTime() >= start.getTime()) endLocal = formatLocal(finish, false);
      }
    }
  }

  let recurrence: Recurrence | null = null;
  if (freq) {
    // A monthly series without a calendar day drifts to the 28th of February
    // and stays there, so the day of the start is used as the anchor.
    const dayOfMonth = byMonthDay ?? ((freq === 'monthly' || freq === 'yearly') ? start.getDate() : null);
    let until = untilRaw ? parseUntil(untilRaw) : null;
    if (!until && count > 0) until = countUntil(start, freq, interval, count, dayOfMonth);
    recurrence = { freq, interval, until, dayOfMonth };
  }

  const draft: ItemDraft = {
    kind: 'event',
    title,
    notes: unescapeText(get('DESCRIPTION')?.value ?? ''),
    allDay: declaredAllDay,
    startLocal: formatLocal(start, declaredAllDay),
    endLocal,
    importance: 'normal',
    color: '',
    groupId: null,
    recurrence,
    remindMinutes: 0,
  };
  const trigger = props.find((p) => p.name === 'TRIGGER');
  if (trigger) {
    const minutes = parseTriggerMinutes(trigger.value);
    if (minutes != null) draft.remindMinutes = minutes;
  }
  if (draft.startLocal) buildSchedule(draft);
  if (draft.startLocal && draft.endLocal) {
    const s = parseLocal(draft.startLocal, draft.allDay);
    const e = parseLocal(draft.endLocal, draft.allDay);
    if (e.getTime() < s.getTime()) throw new Error('end before start');
  }
  return draft;
}

/**
 * Reads the events of a calendar file. A broken event does not stop the
 * import, it is reported in errors and the other events are kept.
 */
export function parseIcs(text: string): IcsParseResult {
  const lines = unfold(text);
  const blocks: Prop[][] = [];
  let current: Prop[] | null = null;
  for (const line of lines) {
    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === 'VEVENT') {
      current = [];
      continue;
    }
    if (prop.name === 'END' && prop.value.toUpperCase() === 'VEVENT') {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    if (current) current.push(prop);
  }

  const events: IcsEvent[] = [];
  const errors: string[] = [];
  if (!blocks.length) {
    errors.push('no calendar events found');
    return { events, errors };
  }
  blocks.forEach((props, index) => {
    try {
      events.push({ draft: buildDraft(props, index + 1, errors), number: index + 1 });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'invalid event';
      errors.push(`event ${index + 1}: ${reason}`);
    }
  });
  return { events, errors };
}
