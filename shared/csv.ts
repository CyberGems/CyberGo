import { buildSchedule, parseLocal } from './schedule';
import type { Group, Item, ItemDraft, Kind, Importance, Freq } from './types';

export const CSV_HEADERS = [
  'kind',
  'title',
  'notes',
  'all_day',
  'start_at',
  'end_at',
  'importance',
  'color',
  'group',
  'recurrence_freq',
  'recurrence_interval',
  'recurrence_day_of_month',
  'recurrence_until',
  'remind_minutes',
] as const;

const LEGACY_HEADERS = ['start date', 'subject', 'group'];

/**
 * A cell that starts with one of these characters is executed as a formula by
 * Excel and LibreOffice. The same reasoning that protects the color column
 * from CSS injection protects every exported cell from formula injection:
 * the value is prefixed with a quote so the spreadsheet keeps it as text.
 */
const FORMULA_HEAD = /^[=+\-@\t\r]/;

/** The characters that make a spreadsheet read a cell as a formula. */
const FORMULA_TRIGGERS = '=+-@\t\r';

function esc(value: string): string {
  // The guard is applied before quoting so the quote is the first character
  // the spreadsheet sees.
  const safe = FORMULA_HEAD.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/**
 * Removes the protective quote esc() adds on export, so an export followed by
 * an import returns the original text. Only a quote that sits in front of a
 * formula trigger is removed, a value that simply starts with an apostrophe
 * is kept.
 */
export function unguardFormula(value: string): string {
  if (value.length > 1 && value[0] === "'" && FORMULA_TRIGGERS.includes(value[1])) {
    return value.slice(1);
  }
  return value;
}

export function toCsv(rows: Record<string, string>[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => esc(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Picks the delimiter used by the first record. Only the characters outside
 * quoted fields are counted, so a comma inside a quoted title is not a
 * delimiter candidate.
 */
function detectDelimiter(src: string): ',' | ';' {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ',') commas += 1;
    else if (ch === ';') semicolons += 1;
    else if (ch === '\n' || ch === '\r') break;
    i++;
  }
  return semicolons > commas ? ';' : ',';
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(src);
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      // Inside a quoted field the line break belongs to the value, so it is
      // kept exactly as it was written.
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // A record ends here. Only line breaks outside quoted fields end a
      // record, a quoted field may hold CRLF, CR or LF of its own.
      if (ch === '\r' && src[i + 1] === '\n') i += 2;
      else i++;
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    table.push(row);
  }
  if (!table.length) return [];
  const header = table[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return table.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').replace(/^\uFEFF/, '');
    });
    return obj;
  });
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function field(row: Record<string, string>, ...names: string[]): string {
  const wanted = names.map(normalizeHeader);
  const key = Object.keys(row).find((candidate) => wanted.includes(normalizeHeader(candidate)));
  return key ? unguardFormula(row[key] ?? '') : '';
}

function hasField(row: Record<string, string>, ...names: string[]): boolean {
  const wanted = names.map(normalizeHeader);
  return Object.keys(row).some((candidate) => wanted.includes(normalizeHeader(candidate)));
}

export function detectCsvFormat(rows: Record<string, string>[]): 'cybergo' | 'legacy' | 'unknown' {
  const first = rows[0];
  if (!first) return 'unknown';
  if (hasField(first, 'title') && hasField(first, 'start_at')) return 'cybergo';
  if (LEGACY_HEADERS.every((header) => hasField(first, header))) return 'legacy';
  return 'unknown';
}

function asKind(value: string, hasStart: boolean): Kind {
  const v = value.trim().toLowerCase();
  if (v === 'task' || v === 'tarea') return 'task';
  if (v === 'event' || v === 'evento') return 'event';
  return hasStart ? 'event' : 'task';
}

function asImportance(value: string): Importance {
  const v = value.trim().toLowerCase();
  if (v === 'high' || v === 'alta') return 'high';
  if (v === 'low' || v === 'baja') return 'low';
  return 'normal';
}

function asBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'si' || v === 'sí';
}

function asFreq(value: string): Freq | null {
  const v = value.trim().toLowerCase();
  if (v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'yearly') return v;
  return null;
}

function numberWord(value: string): number | null {
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
    nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veintiuno: 21, veintidos: 22, veintidós: 22, veintitres: 23, veintitrés: 23,
    veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintiséis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29, treinta: 30, treintauno: 31, 'treinta y uno': 31,
  };
  const numeric = Number(value.trim());
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  return words[normalizeHeader(value).replace(/\s+/g, ' ')] ?? null;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Reads a calendar date out of a date or timestamp. */
function dateParts(value: string): DateParts {
  const raw = value.trim().split(/[T ]/)[0];
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
  const legacy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  const parts = iso
    ? [iso[1], iso[2], iso[3]]
    : legacy
      ? [legacy[3], legacy[2], legacy[1]]
      : null;
  if (!parts) throw new Error('invalid date');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
    throw new Error('invalid date');
  }
  return { year, month, day };
}

function formatDate(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function normalizeDate(value: string): string {
  return formatDate(dateParts(value));
}

interface TimeParts {
  hour: number;
  minute: number;
  second: number;
  /** Minutes to add to the local time to get UTC, null when the time is local. */
  offsetMinutes: number | null;
}

/**
 * Reads a time of day. Seconds and a UTC offset are accepted, a time that
 * carries an offset is an absolute moment and is converted to the local
 * wall clock, a time without one is local already.
 */
function parseTimeParts(value: string): TimeParts {
  const raw = value.trim().toUpperCase();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?(?:\s*(Z|[+-]\d{2}:?\d{2})?)$/.exec(raw);
  if (!match) throw new Error('invalid time');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (minute > 59 || second > 59) throw new Error('invalid time');
  if (match[4]) {
    if (hour < 1 || hour > 12) throw new Error('invalid time');
    if (match[4] === 'AM' && hour === 12) hour = 0;
    if (match[4] === 'PM' && hour !== 12) hour += 12;
  } else if (hour > 23) {
    throw new Error('invalid time');
  }
  let offsetMinutes: number | null = null;
  const offset = match[5];
  if (offset) {
    if (offset === 'Z') {
      offsetMinutes = 0;
    } else {
      const sign = offset[0] === '-' ? -1 : 1;
      const digits = offset.slice(1).replace(':', '');
      const offsetHour = Number(digits.slice(0, 2));
      const offsetMinute = Number(digits.slice(2, 4) || '0');
      if (offsetHour > 23 || offsetMinute > 59) throw new Error('invalid time');
      offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
    }
  }
  return { hour, minute, second, offsetMinutes };
}

/**
 * Normalizes a time of day, for example "9:30 AM". A time that carries a UTC
 * offset is placed on the local clock, the day it lands on is worked out by
 * resolveStamp.
 */
function normalizeTime(value: string): string {
  const parts = parseTimeParts(value);
  if (parts.offsetMinutes !== null) {
    const local = new Date(Date.UTC(1970, 0, 1, parts.hour, parts.minute, parts.second) - parts.offsetMinutes * 60_000);
    return `${pad2(local.getHours())}:${pad2(local.getMinutes())}`;
  }
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Splits a timestamp into its date part and its time part. */
function splitStamp(value: string): { datePart: string; timePart: string } {
  const raw = value.trim();
  const cut = raw.search(/[T ]/);
  if (cut < 0) return { datePart: raw, timePart: '' };
  return { datePart: raw.slice(0, cut), timePart: raw.slice(cut + 1).trim() };
}

/** True when the value carries a time of day and not only a date. */
function hasTimePart(value: string): boolean {
  return splitStamp(value).timePart !== '';
}

/**
 * Turns a date and a time into the local wall clock. A time that carries a
 * UTC offset is an absolute moment, so it is shifted to the local calendar,
 * which can also move the day.
 */
function resolveStamp(dateValue: string, timeValue: string): { date: string; time: string } {
  const date = dateParts(dateValue);
  const time = parseTimeParts(timeValue);
  if (time.offsetMinutes === null) {
    return { date: formatDate(date), time: `${pad2(time.hour)}:${pad2(time.minute)}` };
  }
  const instant = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second)
    - time.offsetMinutes * 60_000;
  const local = new Date(instant);
  return {
    date: `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`,
    time: `${pad2(local.getHours())}:${pad2(local.getMinutes())}`,
  };
}

function normalizeLocal(value: string, allDay: boolean): string {
  const raw = value.trim();
  if (!raw) return '';
  const { datePart, timePart } = splitStamp(raw);
  const date = normalizeDate(datePart);
  if (allDay || !timePart) return date;
  const resolved = resolveStamp(datePart, timePart);
  return `${resolved.date}T${resolved.time}`;
}

function combineLegacyDateTime(dateValue: string, timeValue: string): string {
  const date = normalizeDate(dateValue);
  if (!timeValue.trim()) return date;
  const resolved = resolveStamp(dateValue, timeValue);
  return `${resolved.date}T${resolved.time}`;
}

function nextDateValue(value: string): string {
  const date = new Date(`${normalizeDate(value)}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLegacyRecurrence(raw: string, startLocal: string): ItemDraft['recurrence'] {
  const source = raw.trim();
  if (!source) return null;
  const normalized = source.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const unit = normalized.match(/(?:every|cada)\s+(?:(\d+|[a-z ]+?)\s+)?(day|days|daily|dia|dias|week|weeks|weekly|semana|semanas|month|months|monthly|mes|meses|year|years|yearly|ano|anos|año|años)/);
  if (!unit) return null;
  const unitName = unit[2];
  const freq = /day|daily|dia/.test(unitName)
    ? 'daily'
    : /week|weekly|semana/.test(unitName)
      ? 'weekly'
      : /month|monthly|mes/.test(unitName)
        ? 'monthly'
        : 'yearly';
  const interval = unit[1] ? Math.max(1, numberWord(unit[1]) ?? 1) : 1;
  let dayOfMonth: number | null = null;
  if (freq === 'monthly') {
    const dayMatch = /(?:^|\s)(\d{1,2}|[a-záéíóúñ ]+?)(?:st|nd|rd|th|o|a)?\s*(?:of|de)?\s*(?:every|each|cada)\s+(?:month|mes)/i.exec(normalized);
    const parsedDay = dayMatch ? numberWord(dayMatch[1].trim()) : null;
    if (parsedDay && parsedDay >= 1 && parsedDay <= 31) dayOfMonth = parsedDay;
    if (!dayOfMonth) {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startLocal);
      dayOfMonth = match ? Number(match[3]) : null;
    }
  }
  const untilMatch = /(?:until|hasta)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i.exec(source);
  const until = untilMatch ? normalizeDate(untilMatch[1]) : null;
  return { freq, interval, until, dayOfMonth };
}

/** Only #rrggbb or empty. Anything else becomes empty so a crafted CSV cannot inject CSS. */
export function sanitizeColor(value: string): string {
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '';
}

/** Reads the optional calendar day of a monthly series. */
function parseDayOfMonth(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const day = Math.floor(parsed);
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * A monthly series without a calendar day slides to the 28th of February and
 * stays there, so the day of the start date is used as the anchor.
 */
function anchorFromStart(freq: Freq, startRaw: string): number | null {
  if (freq !== 'monthly' && freq !== 'yearly') return null;
  if (!startRaw) return null;
  const day = Number(startRaw.slice(8, 10));
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * Validates the end of a recurrence. A malformed date is rejected instead of
 * being stored, because a recurrence that should end would never end.
 */
function parseUntil(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    return normalizeDate(raw);
  } catch {
    throw new Error('invalid recurrence_until');
  }
}

export function itemToCsvRow(item: Item, groups: Group[]): Record<string, string> {
  const group = groups.find((g) => g.id === item.groupId);
  const start = item.allDay ? (item.startAt ? localDate(item.startAt) : '') : localStamp(item.startAt);
  const end = item.allDay ? (item.endAt ? localDate(item.endAt) : '') : localStamp(item.endAt);
  return {
    kind: item.kind,
    title: item.title,
    notes: item.notes,
    all_day: item.allDay ? '1' : '0',
    start_at: start,
    end_at: end,
    importance: item.importance,
    color: item.color,
    group: group?.name ?? '',
    recurrence_freq: item.recurrence?.freq ?? '',
    recurrence_interval: item.recurrence ? String(item.recurrence.interval) : '',
    recurrence_day_of_month: item.recurrence?.dayOfMonth ? String(item.recurrence.dayOfMonth) : '',
    recurrence_until: item.recurrence?.until ?? '',
    remind_minutes: String(item.remindMinutes ?? 0),
  };
}

function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function localStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${localDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function rowToDraft(row: Record<string, string>, groups: Group[]): { draft: ItemDraft; newGroupName: string | null } {
  if (hasField(row, 'subject', 'start date')) return legacyRowToDraft(row, groups);
  const title = field(row, 'title').trim();
  if (!title) throw new Error('missing title');
  const startInput = field(row, 'start_at').trim();
  const endInput = field(row, 'end_at').trim();
  const allDay = asBool(field(row, 'all_day'));
  const startRaw = startInput ? normalizeLocal(startInput, allDay || !hasTimePart(startInput)) : '';
  const endRaw = endInput ? normalizeLocal(endInput, allDay || !hasTimePart(endInput)) : '';
  // A value that holds only a date describes a whole day.
  const normalizedAllDay = allDay || (Boolean(startInput) && !hasTimePart(startInput));
  const kind = asKind(field(row, 'kind'), Boolean(startRaw));
  if (startRaw) parseLocal(startRaw, startRaw.length <= 10);
  if (endRaw) parseLocal(endRaw, endRaw.length <= 10);
  const freq = asFreq(field(row, 'recurrence_freq'));
  const interval = Math.max(1, Number(field(row, 'recurrence_interval') || '1') || 1);
  const dayOfMonth = parseDayOfMonth(field(row, 'recurrence_day_of_month'));
  const until = parseUntil(field(row, 'recurrence_until'));
  const groupName = field(row, 'group').trim();
  const existing = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
  const remind = Math.max(0, Number(field(row, 'remind_minutes') || '0') || 0);
  const draft: ItemDraft = {
    kind,
    title,
    notes: field(row, 'notes'),
    allDay: normalizedAllDay,
    startLocal: startRaw ? startRaw.replace(' ', 'T') : null,
    endLocal: endRaw ? endRaw.replace(' ', 'T') : null,
    importance: asImportance(field(row, 'importance')),
    color: sanitizeColor(field(row, 'color')),
    groupId: existing?.id ?? null,
    recurrence: freq ? {
      freq,
      interval,
      until,
      dayOfMonth: dayOfMonth ?? anchorFromStart(freq, startRaw),
    } : null,
    remindMinutes: remind,
  };
  if (draft.startLocal) buildSchedule(draft);
  return { draft, newGroupName: groupName && !existing ? groupName : null };
}

function legacyRowToDraft(row: Record<string, string>, groups: Group[]): { draft: ItemDraft; newGroupName: string | null } {
  const title = field(row, 'Subject').trim();
  if (!title) throw new Error('missing title');
  const startDate = field(row, 'Start Date');
  const rawEndDate = field(row, 'End Date');
  const startTime = field(row, 'Start Time');
  const endTime = field(row, 'End Time');
  const endDate = rawEndDate || (field(row, 'End Time').trim() ? startDate : '');
  const startLocal = startDate ? combineLegacyDateTime(startDate, startTime) : '';
  const endLocal = endDate ? combineLegacyDateTime(endDate, endTime) : '';
  const midnight = !startTime || normalizeTime(startTime) === '00:00';
  const endMidnight = !endTime || normalizeTime(endTime) === '00:00';
  const allDay = Boolean(startDate && endDate && midnight && endMidnight && normalizeDate(endDate) === nextDateValue(startDate));
  const reminderOn = asBool(field(row, 'Reminder On/Off'));
  const reminderLocal = field(row, 'Reminder Date') ? combineLegacyDateTime(field(row, 'Reminder Date'), field(row, 'Reminder Time')) : '';
  const startMoment = startLocal ? parseLocal(startLocal, false) : null;
  const reminderMoment = reminderLocal ? parseLocal(reminderLocal, false) : null;
  const remindMinutes = reminderOn && startMoment && reminderMoment
    ? Math.max(0, Math.round((startMoment.getTime() - reminderMoment.getTime()) / 60_000))
    : 0;
  const location = field(row, 'Location').trim();
  const comment = field(row, 'Comment');
  const notes = location ? `${comment}${comment ? '\n' : ''}Location: ${location}` : comment;
  const groupName = field(row, 'Group').trim();
  const existing = groups.find((group) => group.name.toLowerCase() === groupName.toLowerCase());
  const draft: ItemDraft = {
    kind: asKind('event', Boolean(startLocal)),
    title,
    notes,
    allDay,
    startLocal: allDay ? normalizeDate(startDate) : startLocal,
    endLocal: endDate ? (allDay ? normalizeDate(endDate) : endLocal) : null,
    importance: asImportance(field(row, 'Importance')),
    color: '',
    groupId: existing?.id ?? null,
    recurrence: parseLegacyRecurrence(field(row, 'Recurrence'), startLocal),
    remindMinutes,
  };
  if (draft.startLocal) buildSchedule(draft);
  return { draft, newGroupName: groupName && !existing ? groupName : null };
}
