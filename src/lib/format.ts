import type { Copy } from '../i18n';
import type { Item, Lang } from '@shared/types';

const locale = (lang: Lang) => (lang === 'es' ? 'es-ES' : 'en-US');

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

export function daysLeft(item: Item, copy: Copy): string {
  const diff = dayDiff(item.occurrenceAt || item.startAt);
  if (diff == null) return '';
  if (diff === 0) return copy.todayWord;
  if (diff === 1) return copy.tomorrowWord;
  if (diff < 0) return copy.overdueWord;
  return String(diff);
}

export function duePhrase(iso: string | null, lang: Lang): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const past = ms < 0;
  const abs = Math.abs(ms);
  const minutes = Math.max(1, Math.round(abs / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (lang === 'es') {
    if (minutes < 2 && !past) return 'Ahora';
    if (days >= 1) return past ? `Vencido hace ${days} ${days === 1 ? 'día' : 'días'}` : `En ${days} ${days === 1 ? 'día' : 'días'}`;
    if (hours >= 1) return past ? `Vencido hace ${hours} h` : `En ${hours} h`;
    return past ? `Vencido hace ${minutes} min` : `En ${minutes} min`;
  }
  if (minutes < 2 && !past) return 'Now';
  if (days >= 1) return past ? `Overdue ${days} ${days === 1 ? 'day' : 'days'}` : `In ${days} ${days === 1 ? 'day' : 'days'}`;
  if (hours >= 1) return past ? `Overdue ${hours} h` : `In ${hours} h`;
  return past ? `Overdue ${minutes} min` : `In ${minutes} min`;
}
