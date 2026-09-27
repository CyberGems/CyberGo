import type { Freq, Importance, Recurrence } from './types';
import { nextDate } from './schedule';

export interface QuickDraft {
  title: string;
  allDay: boolean;
  start: Date | null;
  importance: Importance;
  recurrence: Recurrence | null;
}

export type QuickPreset = '10m' | '1h' | 'tonight' | 'tomorrow9';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUMBER_WORDS: Record<string, number> = {
  cero: 0, zero: 0,
  uno: 1, una: 1, un: 1, one: 1,
  dos: 2, two: 2,
  tres: 3, three: 3,
  cuatro: 4, four: 4,
  cinco: 5, five: 5,
  seis: 6, six: 6,
  siete: 7, seven: 7,
  ocho: 8, eight: 8,
  nueve: 9, nine: 9,
  diez: 10, ten: 10,
  once: 11, eleven: 11,
  doce: 12, twelve: 12,
  trece: 13, thirteen: 13,
  catorce: 14, fourteen: 14,
  quince: 15, fifteen: 15,
  dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  veinte: 20, twenty: 20,
  veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintiséis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  twentyone: 21, twentytwo: 22, twentythree: 23, twentyfour: 24, twentyfive: 25,
  twentysix: 26, twentyseven: 27, twentyeight: 28, twentynine: 29,
  treinta: 30, thirty: 30,
  treintauno: 31, treintayuno: 31, 'treinta y uno': 31, thirtyone: 31, 'thirty one': 31,
};
const NUMBER_TOKEN = String.raw`(?:\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})`;
const WEEKDAY_TOKEN = String.raw`(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)`;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function at(day: Date, hour: number, minute: number): Date {
  const next = new Date(day.getTime());
  next.setHours(hour, minute, 0, 0);
  return next;
}

function meridianHour(hour: number, marker: string | undefined): number {
  if (hour > 12) return hour;
  if (!marker) return hour;
  const mark = fold(marker).replace(/\./g, '').replace(/\s/g, '');
  const pm = mark === 'pm' || mark.includes('tarde') || mark.includes('noche') || mark.includes('evening');
  const am = mark === 'am' || mark.includes('manana') || mark.includes('morning');
  if (pm && hour < 12) return hour + 12;
  if (am && hour === 12) return 0;
  return hour;
}

function place(day: Date, hour: number, minute: number, marker: string | undefined, now: Date): Date {
  const stated = meridianHour(hour, marker);
  if (stated > 23) return at(day, 9, 0);
  if (marker || stated > 12) {
    const exact = at(day, stated === 24 ? 0 : stated, minute);
    return exact.getTime() <= now.getTime() ? addDays(exact, 1) : exact;
  }
  const morning = at(day, stated === 12 ? 12 : stated, minute);
  const evening = stated < 12 ? at(day, stated + 12, minute) : null;
  if (morning.getTime() > now.getTime()) return morning;
  if (evening && evening.getTime() > now.getTime()) return evening;
  return addDays(morning, 1);
}

interface RecurrenceMatch {
  rest: string;
  recurrence: Recurrence;
  start: Date;
}

function numberValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const normalized = fold(raw).replace(/[-\s]/g, '');
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[normalized] ?? null;
}

function frequencyForUnit(raw: string): Freq | null {
  const unit = fold(raw);
  if (unit.startsWith('dia') || unit.startsWith('diari') || unit === 'daily' || unit.startsWith('day')) return 'daily';
  if (unit.startsWith('semana') || unit.startsWith('semanal') || unit.startsWith('week')) return 'weekly';
  if (unit.startsWith('mes') || unit.startsWith('mensual') || unit.startsWith('month')) return 'monthly';
  if (unit.startsWith('ano') || unit.startsWith('anual') || unit.startsWith('year')) return 'yearly';
  return null;
}

function recurrenceUntil(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[/-]/).map(Number);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || day > 31 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextMonthlyDay(day: number, hour: number, minute: number, now: Date): Date {
  for (let offset = 0; offset <= 24; offset += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const candidate = new Date(month.getFullYear(), month.getMonth(), Math.min(day, last), hour, minute, 0, 0);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return at(addDays(now, 31), hour, minute);
}

function nextWeekday(weekday: number, hour: number, minute: number, now: Date): Date {
  let delta = (weekday - now.getDay() + 7) % 7;
  let candidate = at(addDays(now, delta), hour, minute);
  if (candidate.getTime() <= now.getTime()) {
    delta += 7;
    candidate = at(addDays(now, delta), hour, minute);
  }
  return candidate;
}

function consumeRecurrenceClock(rest: string): { rest: string; hour: number; minute: number; marker?: string } | null {
  const marker = String.raw`(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm|de la mañana|de la tarde|de la noche|morning|afternoon|evening|night)`;
  const prefixed = consume(rest, String.raw`\b(?:a\s+las|at)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(${marker}))?\b`);
  const marked = prefixed ?? consume(rest, String.raw`\b(\d{1,2})(?::(\d{2}))?\s*(${marker})\b`);
  if (!marked) return null;
  return {
    rest: marked.rest,
    hour: Number(marked.match[1]),
    minute: Number(marked.match[2] || 0),
    marker: marked.match[3],
  };
}

function consumeRecurrenceUntil(rest: string): { rest: string; until: string } | null {
  const hit = consume(rest, String.raw`\b(?:hasta|until)(?:\s+(?:el|the))?\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b`);
  if (!hit) return null;
  const until = recurrenceUntil(hit.match[1]);
  return until ? { rest: hit.rest, until } : null;
}

function parseRecurrence(rest: string, now: Date): RecurrenceMatch | null {
  const dayMonthly = consume(
    rest,
    String.raw`\b(?:cada\s+)?(?:el\s+|los\s+|the\s+|on\s+the\s+)?(${NUMBER_TOKEN})(?:st|nd|rd|th)?\s+(?:de\s+cada\s+mes(?:es)?|of\s+every\s+month(?:s)?)\b`,
  );
  const weekday = dayMonthly
    ? null
    : consume(rest, String.raw`\b(?:cada|todos\s+los|los|every|each|on)\s+(${WEEKDAY_TOKEN})s?\b`);
  const interval = dayMonthly || weekday
    ? null
    : consume(
      rest,
      String.raw`\b(?:cada|todos\s+los|every|each)\s+(?:(` + NUMBER_TOKEN + String.raw`)\s+)?(d[ií]a?s?|diari[oa]s?|daily|days?|semanas?|semanal(?:es)?|weekly|weeks?|mes(?:es)?|mensual(?:es)?|monthly|months?|a[nñ]os?|anual(?:es)?|yearly|years?)\b`,
    );
  const monthlyDay = dayMonthly ? numberValue(dayMonthly.match[1].replace(/(?:st|nd|rd|th)$/i, '')) : null;
  const weekdayName = weekday ? fold(weekday.match[1]) : null;
  const weekdayIndex = weekdayName
    ? (WEEKDAYS.includes(weekdayName) ? WEEKDAYS.indexOf(weekdayName) : WEEKDAYS_EN.indexOf(weekdayName))
    : -1;
  const unit = interval ? frequencyForUnit(interval.match[2]) : null;
  if (!dayMonthly && !weekday && !interval) return null;
  if (dayMonthly && (!monthlyDay || monthlyDay < 1 || monthlyDay > 31)) return null;
  if (weekday && weekdayIndex < 0) return null;
  if (interval && !unit) return null;

  let remaining = (dayMonthly || weekday || interval)!.rest;
  const time = consumeRecurrenceClock(remaining);
  if (time) remaining = time.rest;
  const until = consumeRecurrenceUntil(remaining);
  if (until) remaining = until.rest;
  const hour = time ? meridianHour(time.hour, time.marker) : 9;
  const minute = time?.minute ?? 0;
  let recurrence: Recurrence;
  let start: Date;

  if (dayMonthly) {
    recurrence = { freq: 'monthly', interval: 1, until: until?.until ?? null, dayOfMonth: monthlyDay };
    start = nextMonthlyDay(monthlyDay!, hour, minute, now);
  } else if (weekday) {
    recurrence = { freq: 'weekly', interval: 1, until: until?.until ?? null };
    start = nextWeekday(weekdayIndex, hour, minute, now);
  } else {
    const count = Math.max(1, numberValue(interval!.match[1]) ?? 1);
    recurrence = { freq: unit!, interval: count, until: until?.until ?? null };
    const first = nextDate(now, recurrence) ?? addDays(now, count);
    start = at(first, hour, minute);
  }
  return { rest: remaining, recurrence, start };
}

function consume(rest: string, source: string): { rest: string; match: RegExpExecArray } | null {
  const match = new RegExp(source, 'i').exec(rest);
  if (!match) return null;
  const blank = ' '.repeat(match[0].length);
  return { rest: `${rest.slice(0, match.index)}${blank}${rest.slice(match.index + match[0].length)}`, match };
}

const clock = String.raw`(?:\s*(?:a las|at)\s+)?(\d{1,2})(?::(\d{2}))?(?:\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm|de la mañana|de la tarde|de la noche))?`;

export function presetStart(preset: QuickPreset, now = new Date()): Date {
  if (preset === '10m') return new Date(now.getTime() + 10 * 60_000);
  if (preset === '1h') return new Date(now.getTime() + 60 * 60_000);
  if (preset === 'tonight') {
    const night = at(now, 21, 0);
    return night.getTime() > now.getTime() ? night : addDays(night, 1);
  }
  const morning = at(addDays(now, 1), 9, 0);
  return morning;
}

export function parseQuick(text: string, now = new Date()): QuickDraft {
  let rest = text;
  let importance: Importance = 'normal';
  let allDay = false;
  let start: Date | null = null;
  let recurrence: Recurrence | null = null;

  const important = consume(rest, String.raw`\b(importante|urgente|alta importancia|important|urgent|high importance)\b`);
  if (important) {
    rest = important.rest;
    importance = 'high';
  }
  const dayLong = consume(rest, String.raw`\b(todo el d[ií]a|all day)\b`);
  if (dayLong) {
    rest = dayLong.rest;
    allDay = true;
  }

  const recurring = parseRecurrence(rest, now);
  if (recurring) {
    rest = recurring.rest;
    recurrence = recurring.recurrence;
    start = recurring.start;
  }

  const rules: { source: string; apply: (match: RegExpExecArray) => Date }[] = [
    { source: String.raw`\b(?:en|dentro de|in)\s+(\d+)\s*(?:minutos?|mins?|min|minutes?)\b`, apply: (m) => new Date(now.getTime() + Number(m[1]) * 60_000) },
    { source: String.raw`\b(?:en media hora|en medio hora|in half an hour)\b`, apply: () => new Date(now.getTime() + 30 * 60_000) },
    { source: String.raw`\b(?:en|dentro de|in)\s+(\d+)\s*(?:horas?|hrs?|hours?)\b`, apply: (m) => new Date(now.getTime() + Number(m[1]) * 60 * 60_000) },
    { source: String.raw`\b(?:en una hora|en 1 hora|dentro de una hora|in an hour|in 1 hour)\b`, apply: () => new Date(now.getTime() + 60 * 60_000) },
    { source: String.raw`\b(?:en|dentro de|in)\s+(\d+)\s*(?:d[ií]as?|days?)\b`, apply: (m) => at(addDays(now, Number(m[1])), 9, 0) },
    { source: String.raw`\b(?:pasado mañana|day after tomorrow)(?:\s+${clock})?\b`, apply: (m) => m[1] ? place(addDays(now, 2), Number(m[1]), Number(m[2] || 0), m[3], now) : at(addDays(now, 2), 9, 0) },
    { source: String.raw`\b(?:mañana|tomorrow)(?:\s+${clock})?\b`, apply: (m) => m[1] ? place(addDays(now, 1), Number(m[1]), Number(m[2] || 0), m[3], now) : at(addDays(now, 1), 9, 0) },
    { source: String.raw`\b(?:hoy|today)(?:\s+${clock})?\b`, apply: (m) => m[1] ? place(now, Number(m[1]), Number(m[2] || 0), m[3], now) : at(now, 9, 0) },
    { source: String.raw`\b(?:esta noche|tonight)\b`, apply: () => presetStart('tonight', now) },
    { source: String.raw`\b(?:esta tarde|this evening|this afternoon)\b`, apply: () => { const evening = at(now, 18, 0); return evening.getTime() > now.getTime() ? evening : addDays(evening, 1); } },
    { source: String.raw`\b(?:el\s+|on\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+${clock})?\b`, apply: (m) => {
      const name = fold(m[1]);
      const index = WEEKDAYS.includes(name) ? WEEKDAYS.indexOf(name) : WEEKDAYS_EN.indexOf(name);
      const hour = m[2] ? meridianHour(Number(m[2]), m[4]) : 9;
      const minute = Number(m[3] || 0);
      if (index < 0) return at(addDays(now, 1), hour, minute);
      let delta = (index - now.getDay() + 7) % 7;
      let when = at(addDays(now, delta), hour, minute);
      if (when.getTime() <= now.getTime()) when = addDays(when, 7);
      return when;
    } },
    { source: String.raw`\b(?:a las|at)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm|de la mañana|de la tarde|de la noche))?\b`, apply: (m) => place(now, Number(m[1]), Number(m[2] || 0), m[3], now) },
  ];

  if (!recurrence) {
    for (const rule of rules) {
      const hit = consume(rest, rule.source);
      if (!hit) continue;
      rest = hit.rest;
      start = rule.apply(hit.match);
      break;
    }
  }

  const title = rest
    .replace(/^\s*(?:recordarme|recuérdame|recordar|tarea|task|remind me to|remind me)\b\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
    .trim();

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : '',
    allDay,
    start: start ?? (allDay ? at(now, 9, 0) : null),
    importance,
    recurrence,
  };
}
