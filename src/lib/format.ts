import type { Copy } from '../i18n';
import type { Item, Lang } from '@shared/types';

const locale = (lang: Lang) => (lang === 'es' ? 'es-ES' : 'en-US');

function fill(template: string, duration: string): string {
  return template.replace('{duration}', duration);
}

export function dayDiff(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

export function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatClock(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(item: Item, lang: Lang, copy: Copy): string {
  if (!item.startAt) return '';
  if (item.allDay) return copy.allDay;
  const start = formatClock(item.startAt, lang);
  if (!item.endAt) return start;
  return `${start} - ${formatClock(item.endAt, lang)}`;
}

export function formatDuration(totalMinutes: number, copy: Copy): string {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? copy.dayUnit : copy.daysUnit}`);
  if (hours) parts.push(`${hours} h`);
  if (remainder && parts.length < 2) parts.push(`${remainder} min`);
  return parts.join(' ');
}

export function overduePhrase(iso: string | null, copy: Copy): string {
  if (!iso) return '';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at) || at >= Date.now()) return '';
  const duration = formatDuration((Date.now() - at) / 60_000, copy);
  return fill(copy.overdueBy, duration);
}

/**
 * A duration with short units, for a narrow row.
 *
 * The full wording takes more room than the window has, and the row needs
 * that room for the name of the item.
 */
export function formatDurationShort(totalMinutes: number, copy: Copy): string {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${copy.dayShort}`);
  if (hours) parts.push(`${hours} h`);
  if (remainder && parts.length < 2) parts.push(`${remainder} min`);
  return parts.join(' ');
}

/**
 * The moment an item is due, in the short wording of a row.
 *
 * The color of the row says whether the moment has passed, so the wording
 * only has to say how far away it is.
 */
export function shortDuePhrase(iso: string | null, copy: Copy): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const past = ms < 0;
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (minutes < 2 && !past) return copy.dueNow;
  const duration = formatDurationShort(minutes, copy);
  return fill(past ? copy.overdueShort : copy.dueInShort, duration);
}

export function dueState(iso: string | null): 'overdue' | 'today' | 'future' | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  if (at < Date.now()) return 'overdue';
  return dayDiff(iso) === 0 ? 'today' : 'future';
}

/**
 * The state of an item in the list, with the tone it is drawn with.
 *
 * A task that is late is overdue, because it still waits to be done. An
 * event that already happened is not late, it simply passed, so it gets no
 * state at all. An item in the trash is not pending either.
 */
export function itemStatus(item: Item, copy: Copy, short = false): { label: string; tone: string } {
  if (item.deletedAt) return { label: '', tone: '' };
  const iso = item.occurrenceAt || item.startAt;
  if (!iso) return { label: '', tone: '' };
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return { label: '', tone: '' };
  if (at < Date.now()) {
    if (item.kind === 'event') return { label: '', tone: '' };
    return { label: short ? shortOverduePhrase(iso, copy) : overduePhrase(iso, copy), tone: 'overdue' };
  }
  const diff = dayDiff(iso);
  if (diff === 0) return { label: copy.todayWord, tone: 'today' };
  if (diff === 1) return { label: copy.tomorrowWord, tone: 'future' };
  return { label: copy.inDays.replace('{days}', String(diff)), tone: 'future' };
}

/** How late a reminder is, in the short wording of a narrow column. */
function shortOverduePhrase(iso: string, copy: Copy): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));
  return copy.overdueShort.replace('{duration}', formatDurationShort(minutes, copy));
}

export function duePhrase(iso: string | null, copy: Copy): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const past = ms < 0;
  const abs = Math.abs(ms);
  const minutes = Math.max(1, Math.round(abs / 60_000));
  const duration = formatDuration(minutes, copy);
  if (minutes < 2 && !past) return copy.dueNow;
  return fill(past ? copy.overdueBy : copy.dueIn, duration);
}
