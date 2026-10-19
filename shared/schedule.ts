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
  const [hourText, minuteText, ...rest] = time.split(':');
  if (rest.length > 0) throw new Error('invalid time');
  // A part that is not a number has to be refused. The old check only
  // compared the value, and anything that was not a number slipped
  // through and was read as midnight.
  if (!/^\d{1,2}$/.test(hourText) || Number(hourText) > 23) throw new Error('invalid time');
  const hh = Number(hourText);
  if (minuteText != null && (!/^\d{1,2}$/.test(minuteText) || Number(minuteText) > 59)) {
    throw new Error('invalid time');
  }
  const mm = minuteText == null ? 0 : Number(minuteText);
  return localDate(y, m - 1, d, hh, mm);
}

/**
 * The end of a repetition, when it is a real date.
 *
 * The shape is not enough: the 45th of the 13th month has to be refused,
 * because the date constructor would roll it over to a far away day and
 * the repetition would never end.
 */
function validUntil(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
  return value;
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
  else if (rec.freq === 'yearly') {
    // Yearly keeps the calendar month. setFullYear alone would roll February 29
    // forward to March 1 and freeze the series there.
    const year = d.getFullYear() + n;
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    d.setFullYear(year, month, Math.min(anchor ?? d.getDate(), lastDay));
  }
  else {
    // A frequency nobody knows about cannot be guessed.
    return null;
  }
  const until = validUntil(rec.until);
  if (until) {
    const [y, m, day] = until.split('-').map(Number);
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
  if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly' && freq !== 'yearly') return null;
  const interval = Math.max(1, Math.floor(Number(rec.interval) || 1));
  const until = validUntil(rec.until);
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
  return {
    occurrenceAt: next.toISOString(),
    nextFireAt: fireTimeFor(next.toISOString(), item.remindMinutes),
    snoozeUntil: null,
    alertKey: null,
  };
}

/**
 * The moment the alert of an occurrence has to fire.
 *
 * The fire time follows the occurrence, not the start of the series, so a
 * series that already advanced keeps its own schedule.
 */
export function fireTimeFor(occurrenceIso: string | null, remindMinutes: number): string | null {
  if (!occurrenceIso) return null;
  const at = new Date(occurrenceIso);
  if (Number.isNaN(at.getTime())) return null;
  const minutes = Math.max(0, Math.floor(remindMinutes || 0));
  return new Date(at.getTime() - minutes * 60_000).toISOString();
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
