import type { Importance } from './types';

export interface QuickDraft {
  title: string;
  allDay: boolean;
  start: Date | null;
  importance: Importance;
}

export type QuickPreset = '10m' | '1h' | 'tonight' | 'tomorrow9';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

  for (const rule of rules) {
    const hit = consume(rest, rule.source);
    if (!hit) continue;
    rest = hit.rest;
    start = rule.apply(hit.match);
    break;
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
  };
}
