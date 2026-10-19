import type { Item, ItemDraft, Recurrence } from './types';

export function parseLocal(value: string, allDay: boolean): Date {
  const trimmed = value.trim().replace(' ', 'T');
  const datePart = trimmed.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) throw new Error('invalid date');
  if (m > 12 || d > 31) throw new Error('invalid date');
  if (allDay || trimmed.length <= 10) {
    return localDate(y, m - 1, d, allDay ? 9 : 0, 0);
  }
  const time = trimmed.slice(11);
  const [hh, mm] = time.split(':').map(Number);
  if (hh > 23 || mm > 59) throw new Error('invalid time');
  return localDate(y, m - 1, d, hh || 0, mm || 0);
}

/**
 * Builds a local date and rejects the values the Date constructor would
 * silently roll over, such as the 30th of February. Years below 100 are set
 * explicitly so they are not read as nineteen hundred.
 */
function localDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const date = new Date(year, month, day, hour, minute, 0, 0);
  if (year >= 0 && year < 100) date.setFullYear(year);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    throw new Error('invalid date');
  }
  return date;
}

export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatLocalInput(date: Date, allDay = false): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  if (allDay) return day;
  return `${day}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${toDateInput(iso)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function nextDate(from: Date, rec: Recurrence): Date | null {
  const d = new Date(from.getTime());
  const n = Math.max(1, Math.floor(rec.interval || 1));
  const anchor = anchorDay(rec);
  if (rec.freq === 'daily') d.setDate(d.getDate() + n);
  else if (rec.freq === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (rec.freq === 'monthly') {
    const monthIndex = d.getMonth() + n;
    const year = d.getFullYear() + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();
    // The day anchor lives in the recurrence, so clamping a short month never
    // moves the series to the 28th for good.
    d.setFullYear(year, month, Math.min(anchor ?? d.getDate(), lastDay));
  }
  else {
    // Yearly keeps the calendar month. setFullYear alone would roll February 29
    // forward to March 1 and freeze the series there.
    const year = d.getFullYear() + n;
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    d.setFullYear(year, month, Math.min(anchor ?? d.getDate(), lastDay));
  }
  if (rec.until) {
    const [y, m, day] = rec.until.split('-').map(Number);
    if (!y || !m || !day) return d;
    const end = new Date(y, m - 1, day, 23, 59, 59, 999);
    if (d.getTime() > end.getTime()) return null;
  }
  return d;
}

function anchorDay(rec: Recurrence): number | null {
  const day = Number(rec.dayOfMonth);
  return day >= 1 && day <= 31 ? Math.floor(day) : null;
}

/**
 * Fills in the calendar day a monthly series must return to. Without it a
 * January 31 event would settle on the 28th of February and stay there.
 */
export function normalizeRecurrence(rec: Recurrence | null, startLocal: string | null): Recurrence | null {
  if (!rec) return null;
  const freq = rec.freq;
  const interval = Math.max(1, Math.floor(Number(rec.interval) || 1));
  const until = /^\d{4}-\d{2}-\d{2}$/.test(rec.until ?? '') ? rec.until : null;
  let dayOfMonth = anchorDay(rec);
  if ((freq === 'monthly' || freq === 'yearly') && dayOfMonth == null && startLocal) {
    const day = Number(startLocal.slice(8, 10));
    if (day >= 1 && day <= 31) dayOfMonth = day;
  }
  return { freq, interval, until, dayOfMonth };
}

export function buildSchedule(draft: Pick<ItemDraft, 'startLocal' | 'endLocal' | 'allDay' | 'remindMinutes'>) {
  if (!draft.startLocal) {
    return { startAt: null as string | null, endAt: null as string | null, occurrenceAt: null as string | null, nextFireAt: null as string | null };
  }
  const start = parseLocal(draft.startLocal, draft.allDay);
  const end = draft.endLocal ? parseLocal(draft.endLocal, draft.allDay) : null;
  const remind = Math.max(0, Math.floor(draft.remindMinutes || 0));
  const fire = new Date(start.getTime() - remind * 60_000);
  return {
    startAt: start.toISOString(),
    endAt: end ? end.toISOString() : null,
    occurrenceAt: start.toISOString(),
    nextFireAt: fire.toISOString(),
  };
}

export function fireKey(item: Pick<Item, 'snoozeUntil' | 'nextFireAt'>): string | null {
  if (item.snoozeUntil) return `snooze:${item.snoozeUntil}`;
  if (item.nextFireAt) return `fire:${item.nextFireAt}`;
  return null;
}

export function isDue(item: Item, nowMs: number): boolean {
  if (item.deletedAt || item.completedAt) return false;
  if (item.alertKey === 'dismissed' && !item.snoozeUntil) return false;
  if (item.snoozeUntil) return new Date(item.snoozeUntil).getTime() <= nowMs;
  if (!item.nextFireAt) return false;
  return new Date(item.nextFireAt).getTime() <= nowMs;
}

export function afterDismiss(item: Item): Pick<Item, 'occurrenceAt' | 'nextFireAt' | 'snoozeUntil' | 'alertKey'> {
  const cleared = {
    occurrenceAt: item.occurrenceAt,
    nextFireAt: null as string | null,
    snoozeUntil: null as string | null,
    alertKey: 'dismissed',
  };
  if (!item.recurrence || !item.occurrenceAt) return cleared;
  const next = nextDate(new Date(item.occurrenceAt), item.recurrence);
  if (!next) return cleared;
  const fire = new Date(next.getTime() - Math.max(0, item.remindMinutes) * 60_000);
  return {
    occurrenceAt: next.toISOString(),
    nextFireAt: fire.toISOString(),
    snoozeUntil: null,
    alertKey: null,
  };
}

export function snoozeUntilFromNow(minutes: number, now = new Date()): string {
  const n = Math.max(1, Math.floor(minutes));
  return new Date(now.getTime() + n * 60_000).toISOString();
}

export function tomorrowAtNine(now = new Date()): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
