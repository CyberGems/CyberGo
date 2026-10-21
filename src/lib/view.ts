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

/** The columns of the list that can be ordered. */
export type SortColumn = 'date' | 'time' | 'state' | 'subject' | 'kind';
export type SortDirection = 'asc' | 'desc';

/**
 * The group of the state of an item.
 *
 * It follows the wording of the column, so the order of the list is the
 * order of the words that are read in it: what is late, what is today, what
 * is tomorrow, what is later, and what is already over.
 */
function stateGroup(item: Item): number {
  const iso = whenOf(item);
  if (!iso) return 4;
  if (new Date(iso).getTime() < Date.now()) {
    // A late task still waits to be done. An event that already happened is
    // over, and it goes with the rest.
    return item.kind === 'task' ? 0 : 4;
  }
  const diff = dayDiff(iso);
  if (diff === 0) return 1;
  if (diff === 1) return 2;
  return 3;
}

/**
 * Orders the items by one of the columns of the list.
 *
 * The items that have no date are always at the end, in both directions,
 * because they have no place in the order of a date.
 */
export function sortByColumn(items: Item[], column: SortColumn, direction: SortDirection): Item[] {
  const copy = [...items];
  const sign = direction === 'asc' ? 1 : -1;
  const byTitle = (a: Item, b: Item) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  copy.sort((a, b) => {
    if (column === 'subject') return sign * byTitle(a, b);
    if (column === 'kind') {
      const ka = a.kind === 'task' ? 0 : 1;
      const kb = b.kind === 'task' ? 0 : 1;
      if (ka !== kb) return sign * (ka - kb);
      return sign * byTitle(a, b);
    }
    const av = whenOf(a);
    const bv = whenOf(b);
    if (!av && !bv) return byTitle(a, b);
    if (!av) return 1;
    if (!bv) return -1;
    if (column === 'time') {
      const da = new Date(av);
      const db = new Date(bv);
      const ma = da.getHours() * 60 + da.getMinutes();
      const mb = db.getHours() * 60 + db.getMinutes();
      if (ma !== mb) return sign * (ma - mb);
      return sign * (da.getTime() - db.getTime());
    }
    if (column === 'state') {
      const ga = stateGroup(a);
      const gb = stateGroup(b);
      if (ga !== gb) return sign * (ga - gb);
      return sign * (new Date(av).getTime() - new Date(bv).getTime());
    }
    return sign * (new Date(av).getTime() - new Date(bv).getTime());
  });
  return copy;
}
