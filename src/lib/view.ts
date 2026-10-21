import { dayDiff } from './format';
import type { Item } from '@shared/types';

export type FilterId = 'all' | 'today' | 'next7' | 'next30' | 'upcoming' | 'overdue' | 'high' | 'completed' | 'trash' | 'task' | 'event';

export function whenOf(item: Item): string | null {
  return item.occurrenceAt || item.startAt;
}

export function matchesFilter(item: Item, filter: FilterId, groupId: string | null): boolean {
  if (filter === 'trash') return !!item.deletedAt;
  if (item.deletedAt) return false;
  if (filter === 'completed') return !!item.completedAt;
  if (item.completedAt) return false;
  if (groupId) return item.groupId === groupId;
  const diff = dayDiff(whenOf(item));
  if (filter === 'all') return true;
  if (filter === 'high') return item.importance === 'high';
  if (filter === 'task') return item.kind === 'task';
  if (filter === 'event') return item.kind === 'event';
  if (filter === 'today') return diff === 0;
  if (filter === 'next7') return diff != null && diff >= 0 && diff <= 6;
  if (filter === 'next30') return diff != null && diff >= 0 && diff <= 29;
  if (filter === 'upcoming') return diff == null || diff >= 0;
  if (filter === 'overdue') return diff != null && diff < 0;
  return true;
}

export function sortItems(items: Item[], filter: FilterId): Item[] {
  const copy = [...items];
  if (filter === 'trash') {
    copy.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    return copy;
  }
  copy.sort((a, b) => {
    const av = whenOf(a);
    const bv = whenOf(b);
    if (!av && !bv) return a.title.localeCompare(b.title);
    if (!av) return 1;
    if (!bv) return -1;
    return new Date(av).getTime() - new Date(bv).getTime();
  });
  return copy;
}
