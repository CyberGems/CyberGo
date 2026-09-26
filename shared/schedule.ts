import type { Item, ItemDraft, Recurrence } from './types';

export function parseLocal(value: string, allDay: boolean): Date {
  const trimmed = value.trim().replace(' ', 'T');
  const datePart = trimmed.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) throw new Error('invalid date');
  if (allDay || trimmed.length <= 10) {
    return new Date(y, m - 1, d, allDay ? 9 : 0, 0, 0, 0);
  }
  const time = trimmed.slice(11);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  if (rec.freq === 'daily') d.setDate(d.getDate() + n);
  else if (rec.freq === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (rec.freq === 'monthly') d.setMonth(d.getMonth() + n);
  else d.setFullYear(d.getFullYear() + n);
  if (rec.until) {
    const [y, m, day] = rec.until.split('-').map(Number);
    if (!y || !m || !day) return d;
    const end = new Date(y, m - 1, day, 23, 59, 59, 999);
    if (d.getTime() > end.getTime()) return null;
  }
  return d;
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
