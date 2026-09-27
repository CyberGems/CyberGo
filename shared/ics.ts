import { buildSchedule, parseLocal } from './schedule';
import type { Freq, ItemDraft } from './types';

export interface IcsEvent {
  draft: ItemDraft;
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

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
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

/** Parses an ICS date value into a Date plus whether it is a whole day. */
function parseIcsDate(value: string): { date: Date; allDay: boolean } {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(d), 9, 0, 0, 0), allDay: true };
  }
  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/.exec(v);
  if (!stamp) throw new Error('bad date');
  const [, y, m, d, hh, mm, ss, z] = stamp;
  if (z) {
    return {
      date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0'))),
      allDay: false,
    };
  }
  return {
    date: new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0')),
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

function parseUntil(value: string): string | null {
  try {
    const { date } = parseIcsDate(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  } catch {
    return null;
  }
}

function parseTriggerMinutes(value: string): number | null {
  const match = /^-PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const minutes = (Number(match[1] || 0) * 60) + Number(match[2] || 0) + Math.round(Number(match[3] || 0) / 60);
  return minutes > 0 ? minutes : null;
}

export function parseIcs(text: string): IcsEvent[] {
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

  return blocks.map((props) => {
    const get = (name: string): Prop | undefined => props.find((p) => p.name === name);
    const title = unescapeText(get('SUMMARY')?.value ?? '').trim();
    if (!title) throw new Error('missing SUMMARY');
    const startProp = get('DTSTART');
    if (!startProp) throw new Error('missing DTSTART');
    const { date: start, allDay: dateOnly } = parseIcsDate(startProp.value);
    const declaredAllDay = startProp.params.includes('VALUE=DATE') || dateOnly;
    const endProp = get('DTEND');
    let end: Date | null = null;
    if (endProp) {
      try {
        end = parseIcsDate(endProp.value).date;
      } catch {
        end = null;
      }
    }
    let endLocal: string | null = null;
    if (end) {
      if (declaredAllDay) {
        const last = new Date(end);
        last.setDate(last.getDate() - 1);
        if (last > start) endLocal = formatLocal(last, true);
      } else if (end.getTime() >= start.getTime()) {
        endLocal = formatLocal(end, false);
      } else {
        throw new Error('end before start');
      }
    }
    const rrule = get('RRULE')?.value ?? '';
    const freq = asFreq(/FREQ=([A-Z]+)/.exec(rrule)?.[1] ?? '');
    const interval = Math.max(1, Number(/INTERVAL=(\d+)/.exec(rrule)?.[1] || '1') || 1);
    const untilRaw = /UNTIL=([^;]+)/.exec(rrule)?.[1] ?? '';
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
      recurrence: freq ? { freq, interval, until: untilRaw ? parseUntil(untilRaw) : null } : null,
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
    return { draft };
  });
}
