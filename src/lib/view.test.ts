import assert from 'node:assert/strict';
import test from 'node:test';
import type { Item } from '@shared/types';
import { readStoredSort, sortByColumn, writeStoredSort } from './view';

/** Runs a test with a storage that only lives in memory. */
function withStorage(run: () => void) {
  const store = new Map<string, string>();
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
  try {
    run();
  } finally {
    if (original === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = original;
  }
}

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    kind: 'task',
    title: id,
    notes: '',
    allDay: false,
    startAt: '2026-10-20T09:00:00.000Z',
    endAt: null,
    importance: 'normal',
    color: '',
    groupId: null,
    recurrence: null,
    remindMinutes: 0,
    occurrenceAt: null,
    nextFireAt: null,
    snoozeUntil: null,
    alertKey: null,
    completedAt: null,
    deletedAt: null,
    remoteId: null,
    syncRev: 1,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...extra,
  };
}

const items: Item[] = [
  item('mediana', { title: 'Mediana', startAt: '2026-10-22T12:00:00.000Z' }),
  item('ana', { title: 'Ana', kind: 'event', startAt: '2026-10-21T08:00:00.000Z' }),
  item('sin-fecha', { title: 'Sin fecha', startAt: null }),
  item('zora', { title: 'Zora', startAt: '2026-10-20T20:00:00.000Z' }),
];

function titles(list: Item[]): string[] {
  return list.map((entry) => entry.title);
}

test('the subject is ordered by its name, in both ways', () => {
  assert.deepEqual(titles(sortByColumn(items, 'subject', 'asc')), ['Ana', 'Mediana', 'Sin fecha', 'Zora']);
  assert.deepEqual(titles(sortByColumn(items, 'subject', 'desc')), ['Zora', 'Sin fecha', 'Mediana', 'Ana']);
});

test('the date is ordered by the moment, and the ones without date are always at the end', () => {
  assert.deepEqual(titles(sortByColumn(items, 'date', 'asc')), ['Zora', 'Ana', 'Mediana', 'Sin fecha']);
  assert.deepEqual(titles(sortByColumn(items, 'date', 'desc')), ['Mediana', 'Ana', 'Zora', 'Sin fecha']);
});

test('the hour is ordered by the time of the day', () => {
  const byTime = sortByColumn(items, 'time', 'asc');
  assert.deepEqual(titles(byTime).slice(0, 3), ['Ana', 'Mediana', 'Zora']);
  assert.equal(titles(byTime)[3], 'Sin fecha');
});

test('the kind is ordered with the tasks first', () => {
  const byKind = sortByColumn(items, 'kind', 'asc');
  assert.equal(byKind[0].kind, 'task');
  assert.equal(byKind[byKind.length - 1].kind, 'event');
});

test('the state is ordered with what is late first, and what is over at the end', () => {
  const late = item('late', { kind: 'task', startAt: '2020-01-01T10:00:00.000Z' });
  const over = item('over', { kind: 'event', startAt: '2020-01-02T10:00:00.000Z' });
  const today = item('today', { startAt: new Date().toISOString() });
  const byState = sortByColumn([over, today, late], 'state', 'asc');
  assert.deepEqual(titles(byState), ['late', 'today', 'over']);
});

test('the order of the list is kept between sessions', () => {
  withStorage(() => {
    assert.equal(readStoredSort(), null);
    writeStoredSort({ column: 'subject', direction: 'desc' });
    assert.deepEqual(readStoredSort(), { column: 'subject', direction: 'desc' });
    writeStoredSort(null);
    assert.equal(readStoredSort(), null);
  });
});

test('an order that is not one of the columns is forgotten', () => {
  withStorage(() => {
    writeStoredSort({ column: 'subject', direction: 'asc' });
    (globalThis as { localStorage: Storage }).localStorage.setItem('cybergo-table-sort-v1', '{"column":"nonsense","direction":"asc"}');
    assert.equal(readStoredSort(), null);
    (globalThis as { localStorage: Storage }).localStorage.setItem('cybergo-table-sort-v1', 'not even json');
    assert.equal(readStoredSort(), null);
  });
});
