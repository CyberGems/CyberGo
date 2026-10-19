import type { Freq, Importance, Recurrence } from './types';
import { formatLocalInput, nextDate, normalizeRecurrence } from './schedule';

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

/**
 * Words that turn a plain hour into a moment of the day. A bare number is
 * never a time, so "buy 3 apples" stays intact.
 */
const TIME_MARKER = String.raw`(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm|in\s+the\s+(?:morning|afternoon|evening)|in\s+(?:morning|afternoon|evening)|morning|afternoon|evening|night|de\s+la\s+ma[nñ]ana|por\s+la\s+ma[nñ]ana|de\s+la\s+tarde|por\s+la\s+tarde|de\s+la\s+noche|por\s+la\s+noche|la\s+ma[nñ]ana|la\s+tarde|la\s+noche)(?![\p{L}\d])`;
/** Prepositions that introduce an hour on their own. */
const TIME_PREFIX = String.raw`(?:a\s+las?|at|from|desde|de\s+las)`;

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

function isPmMarker(marker: string): boolean {
  const mark = fold(marker).replace(/[.\s]/g, '');
  return mark.includes('pm') || mark.includes('tarde') || mark.includes('noche')
    || mark.includes('evening') || mark.includes('afternoon') || mark.includes('night');
}

function isAmMarker(marker: string): boolean {
  const mark = fold(marker).replace(/[.\s]/g, '');
  return mark.includes('am') || mark.includes('manana') || mark.includes('morning');
}

/**
 * Turns an hour into a 24 hour value. A written meridian wins, otherwise the
 * business hours rule keeps the same phrase meaning the same thing no matter
 * which day word surrounds it.
 */
function resolveHour(hour: number, marker: string | null): number {
  if (marker) {
    if (hour > 12) return hour;
    if (isPmMarker(marker)) return hour === 12 ? 12 : hour + 12;
    return hour === 12 ? 0 : hour;
  }
  if (hour >= 13) return hour;
  if (hour >= 1 && hour <= 6) return hour + 12;
  return hour;
}

interface TimeFragment {
  rest: string;
  hour: number;
  minute: number;
  marker: string | null;
}

/** Pulls a time out of the sentence, wherever it sits, and removes it. */
function extractTime(rest: string): TimeFragment | null {
  // Each pattern is tried against the untouched text, so a match that turns
  // out to be an impossible hour leaves the sentence alone.
  const patterns: { source: string; marker: boolean }[] = [
    { source: String.raw`\b${TIME_PREFIX}\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(${TIME_MARKER}))?`, marker: true },
    { source: String.raw`\b(\d{1,2})(?:[:.](\d{2}))?\s*(${TIME_MARKER})`, marker: true },
    { source: String.raw`\b(\d{1,2}):(\d{2})`, marker: false },
  ];
  for (const pattern of patterns) {
    const hit = consume(rest, pattern.source);
    if (!hit) continue;
    const hour = Number(hit.match[1]);
    const minute = Number(hit.match[2] || 0);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) continue;
    return {
      rest: hit.rest,
      hour,
      minute,
      marker: pattern.marker ? hit.match[3] ?? null : null,
    };
  }
  return null;
}

type DaySpec =
  | { kind: 'offset'; days: number }
  | { kind: 'fixed'; hour: number; minute: number }
  | { kind: 'weekday'; index: number; strict: boolean };

interface DayFragment {
  rest: string;
  day: DaySpec;
}

/** Pulls a day out of the sentence, wherever it sits, and removes it. */
function extractDay(rest: string): DayFragment | null {
  const two = consume(rest, String.raw`\b(?:pasado\s+ma[nñ]ana|day\s+after\s+tomorrow)\b`);
  if (two) return { rest: two.rest, day: { kind: 'offset', days: 2 } };
  const one = consume(rest, String.raw`\b(?<!\bde\s)(?<!\bpor\s)(?:la\s+ma[nñ]ana|ma[nñ]ana|tomorrow)\b`);
  if (one) return { rest: one.rest, day: { kind: 'offset', days: 1 } };
  const zero = consume(rest, String.raw`\b(?:hoy|today)\b`);
  if (zero) return { rest: zero.rest, day: { kind: 'offset', days: 0 } };
  const night = consume(rest, String.raw`\b(?:esta\s+noche|tonight)\b`);
  if (night) return { rest: night.rest, day: { kind: 'fixed', hour: 21, minute: 0 } };
  const evening = consume(rest, String.raw`\b(?:esta\s+tarde|this\s+afternoon|this\s+evening)\b`);
  if (evening) return { rest: evening.rest, day: { kind: 'fixed', hour: 18, minute: 0 } };
  const weekday = consume(
    rest,
    String.raw`\b(?:el\s+|la\s+|los\s+|on\s+|the\s+)?(?:pr[oó]xim[oa]?|next|este|esta|this)?\s*(${WEEKDAY_TOKEN})\b`,
  );
  if (weekday) {
    const name = fold(weekday.match[1]);
    const index = WEEKDAYS.includes(name) ? WEEKDAYS.indexOf(name) : WEEKDAYS_EN.indexOf(name);
    if (index >= 0) {
      const strict = /\b(?:proximo|next)\b/.test(fold(weekday.match[0]));
      return { rest: weekday.rest, day: { kind: 'weekday', index, strict } };
    }
  }
  const days = consume(rest, String.raw`\b(?:en|dentro\s+de|in)\s+(\d+)\s*(?:d[ií]as?|days?)\b`);
  if (days) return { rest: days.rest, day: { kind: 'offset', days: Number(days.match[1]) } };
  return null;
}

/**
 * Combines a day and a time. A written day is fixed, so it never rolls over.
 * Without a day the target is today, moved to tomorrow when the moment has
 * already passed.
 */
function combineDayAndTime(day: DaySpec | null, time: TimeFragment | null, now: Date): Date | null {
  if (!day && !time) return null;
  const hour = time ? resolveHour(time.hour, time.marker) : 9;
  const minute = time ? time.minute : 0;
  if (!day) {
    const today = at(now, hour, minute);
    return today.getTime() >= now.getTime() ? today : addDays(today, 1);
  }
  if (day.kind === 'offset') return at(addDays(now, day.days), hour, minute);
  if (day.kind === 'fixed') return time ? at(now, hour, minute) : at(now, day.hour, day.minute);
  const delta = (day.index - now.getDay() + 7) % 7;
  if (day.strict) {
    const next = delta === 0 ? 7 : delta;
    return at(addDays(now, next), hour, minute);
  }
  const when = at(addDays(now, delta), hour, minute);
  return when.getTime() < now.getTime() ? addDays(when, 7) : when;
}

interface RelativeFragment {
  rest: string;
  start: Date;
}

/** Pulls an offset from now, such as "en 10 minutos" or "in 2 hours". */
function extractRelative(rest: string, now: Date): RelativeFragment | null {
  const minutes = consume(rest, String.raw`\b(?:en|dentro\s+de|in)\s+(\d+)\s*(?:minutos?|mins?|min|minutes?)\b`);
  if (minutes) return { rest: minutes.rest, start: new Date(now.getTime() + Number(minutes.match[1]) * 60_000) };
  const half = consume(rest, String.raw`\b(?:en\s+media\s+hora|en\s+medio\s+hora|in\s+half\s+an\s+hour)\b`);
  if (half) return { rest: half.rest, start: new Date(now.getTime() + 30 * 60_000) };
  const hours = consume(rest, String.raw`\b(?:en|dentro\s+de|in)\s+(\d+)\s*(?:horas?|hrs?|hours?)\b`);
  if (hours) return { rest: hours.rest, start: new Date(now.getTime() + Number(hours.match[1]) * 3_600_000) };
  const oneHour = consume(rest, String.raw`\b(?:en\s+una\s+hora|en\s+1\s+hora|dentro\s+de\s+una\s+hora|in\s+an\s+hour|in\s+1\s+hour)\b`);
  if (oneHour) return { rest: oneHour.rest, start: new Date(now.getTime() + 3_600_000) };
  return null;
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

function consumeRecurrenceUntil(rest: string): { rest: string; until: string } | null {
  const hit = consume(rest, String.raw`\b(?:hasta|until)(?:\s+(?:el|the))?\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b`);
  if (!hit) return null;
  const until = recurrenceUntil(hit.match[1]);
  return until ? { rest: hit.rest, until } : null;
}

function parseRecurrence(rest: string, now: Date): RecurrenceMatch | null {
  const dayMonthly = consume(
    rest,
    String.raw`\b(?:cada\s+)?(?:el\s+|los\s+|the\s+|on\s+the\s+)?(?:d[ií]a|day)?\s*(${NUMBER_TOKEN})(?:st|nd|rd|th)?\s+(?:de\s+cada\s+mes(?:es)?|of\s+every\s+month(?:s)?)\b`,
  );
  // "on monday" is a single day, not a repeat, so "on" is not a repeat marker.
  const weekday = dayMonthly
    ? null
    : consume(rest, String.raw`\b(?:cada|todos\s+los|los|every|each)\s+(${WEEKDAY_TOKEN})s?\b`);
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
  const until = consumeRecurrenceUntil(remaining);
  if (until) remaining = until.rest;
  const time = extractTime(remaining);
  if (time) remaining = time.rest;
  const hour = time ? resolveHour(time.hour, time.marker) : 9;
  const minute = time?.minute ?? 0;
  let recurrence: Recurrence;
  let start: Date;

  if (dayMonthly) {
    recurrence = { freq: 'monthly', interval: 1, until: until?.until ?? null, dayOfMonth: monthlyDay };
    start = nextMonthlyDay(monthlyDay!, hour, minute, now);
    recurrence = normalizeRecurrence(recurrence, formatLocalInput(start)) ?? recurrence;
  } else if (weekday) {
    recurrence = { freq: 'weekly', interval: 1, until: until?.until ?? null };
    start = nextWeekday(weekdayIndex, hour, minute, now);
  } else {
    const count = Math.max(1, numberValue(interval!.match[1]) ?? 1);
    const base: Recurrence = { freq: unit!, interval: count, until: until?.until ?? null };
    const first = nextDate(now, base) ?? addDays(now, count);
    start = at(first, hour, minute);
    // A monthly rule always keeps the calendar day it lands on.
    recurrence = base.freq === 'monthly'
      ? (normalizeRecurrence(base, formatLocalInput(start)) ?? base)
      : base;
  }
  return { rest: remaining, recurrence, start };
}

function consume(rest: string, source: string): { rest: string; match: RegExpExecArray } | null {
  const match = new RegExp(source, 'i').exec(rest);
  if (!match) return null;
  const blank = ' '.repeat(match[0].length);
  return { rest: `${rest.slice(0, match.index)}${blank}${rest.slice(match.index + match[0].length)}`, match };
}

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
  } else {
    const relative = extractRelative(rest, now);
    if (relative) {
      rest = relative.rest;
      start = relative.start;
    } else {
      // The time and the day are read on their own, so their order in the
      // sentence does not matter and neither leaks into the title.
      const time = extractTime(rest);
      if (time) rest = time.rest;
      const day = extractDay(rest);
      if (day) rest = day.rest;
      start = combineDayAndTime(day?.day ?? null, time, now);
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
