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

function esc(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: Record<string, string>[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => esc(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let delimiter: ',' | ';' = ',';
  let commas = 0;
  let semicolons = 0;
  let quotedHeader = false;
  for (const ch of src) {
    if (ch === '"') quotedHeader = !quotedHeader;
    else if (!quotedHeader && ch === ',') commas += 1;
    else if (!quotedHeader && ch === ';') semicolons += 1;
    else if (!quotedHeader && ch === '\n') break;
  }
  if (semicolons > commas) delimiter = ';';
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
    if (ch === '\n') {
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
      i++;
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
  return key ? row[key] ?? '' : '';
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

function normalizeDate(value: string): string {
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
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeTime(value: string): string {
  const raw = value.trim().toUpperCase();
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/.exec(raw);
  if (!match) throw new Error('invalid time');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) throw new Error('invalid time');
  if (match[3]) {
    if (hour < 1 || hour > 12) throw new Error('invalid time');
    if (match[3] === 'AM' && hour === 12) hour = 0;
    if (match[3] === 'PM' && hour !== 12) hour += 12;
  } else if (hour > 23) {
    throw new Error('invalid time');
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeLocal(value: string, allDay: boolean): string {
  const raw = value.trim();
  if (!raw) return '';
  const date = normalizeDate(raw);
  if (allDay || raw.length <= 10) return date;
  const time = raw.slice(10).trim().replace(/^T/, '');
  return `${date}T${normalizeTime(time)}`;
}

function combineLegacyDateTime(dateValue: string, timeValue: string): string {
  const date = normalizeDate(dateValue);
  return timeValue.trim() ? `${date}T${normalizeTime(timeValue)}` : date;
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
  const startRaw = startInput ? normalizeLocal(startInput, allDay || startInput.length <= 10) : '';
  const endRaw = endInput ? normalizeLocal(endInput, allDay || endInput.length <= 10) : '';
  const normalizedAllDay = allDay || (Boolean(startInput) && startInput.length <= 10);
  const kind = asKind(field(row, 'kind'), Boolean(startRaw));
  if (startRaw) parseLocal(startRaw, allDay || startRaw.length <= 10);
  if (endRaw) parseLocal(endRaw, normalizedAllDay || endRaw.length <= 10);
  const freq = asFreq(field(row, 'recurrence_freq'));
  const interval = Math.max(1, Number(field(row, 'recurrence_interval') || '1') || 1);
  const dayOfMonth = Number(field(row, 'recurrence_day_of_month'));
  const until = field(row, 'recurrence_until').trim();
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
      until: until || null,
      dayOfMonth: dayOfMonth >= 1 && dayOfMonth <= 31 ? Math.floor(dayOfMonth) : null,
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
