import assert from 'node:assert/strict';
import test from 'node:test';
import { copyOf } from '../i18n';
import { duePhrase, formatDuration, formatDurationShort, itemStatus, overduePhrase, shortDuePhrase } from './format';
import type { Item } from '@shared/types';

const es = copyOf('es');
const en = copyOf('en');

test('formats elapsed time with useful mixed units', () => {
  assert.equal(formatDuration(1, es), '1 min');
  assert.equal(formatDuration(65, es), '1 h 5 min');
  assert.equal(formatDuration(1_500, es), '1 día 1 h');
  assert.equal(formatDuration(65, en), '1 h 5 min');
});

test('uses the same friendly overdue duration for panel and reminders', () => {
  const overdue = new Date(Date.now() - (2 * 60 + 5) * 60_000).toISOString();
  assert.match(overduePhrase(overdue, es), /^Vencido hace 2 h 5 min$/);
  assert.match(duePhrase(overdue, en), /^Overdue by 2 h 5 min$/);
});

function item(partial: Partial<Item>): Item {
  return {
    id: '1',
    kind: 'task',
    title: 'A',
    notes: '',
    allDay: false,
    startAt: null,
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
    syncRev: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

test('a task that is late is overdue and an event that passed is not', () => {
  const past = new Date(Date.now() - (2 * 60 + 5) * 60_000).toISOString();
  const late = itemStatus(item({ kind: 'task', occurrenceAt: past }), es);
  assert.equal(late.tone, 'overdue');
  assert.match(late.label, /^Vencido hace 2 h 5 min$/);

  // An event that already happened is not late, it simply passed.
  const passed = itemStatus(item({ kind: 'event', occurrenceAt: past }), es);
  assert.equal(passed.label, '');
  assert.equal(passed.tone, '');
});

test('the state of an item says how far away it is', () => {
  const today = new Date();
  today.setHours(23, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const later = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  assert.equal(itemStatus(item({ occurrenceAt: today.toISOString() }), es).label, 'Hoy');
  assert.equal(itemStatus(item({ occurrenceAt: tomorrow.toISOString() }), es).label, 'Mañana');
  assert.equal(itemStatus(item({ occurrenceAt: later.toISOString() }), es).label, 'En 3 días');
  assert.equal(itemStatus(item({ occurrenceAt: later.toISOString() }), en).label, 'In 3 days');
});

test('an item without a date, or in the trash, has no state', () => {
  assert.equal(itemStatus(item({ occurrenceAt: null }), es).label, '');
  const deleted = item({ occurrenceAt: new Date().toISOString(), deletedAt: new Date().toISOString() });
  assert.equal(itemStatus(deleted, es).label, '');
});

test('the short wording of a row keeps the room for the name', () => {
  const past = new Date(Date.now() - (26 * 60 + 30) * 60_000).toISOString();
  // A day replaces the hours, and the leftover minutes are dropped, so the
  // wording never takes more than two pieces.
  assert.equal(shortDuePhrase(past, es), 'hace 1 d 2 h');
  assert.equal(shortDuePhrase(past, en), '1 d 2 h ago');

  const ahead = new Date(Date.now() + (3 * 24 * 60 + 20 * 60) * 60_000).toISOString();
  assert.equal(shortDuePhrase(ahead, es), 'en 3 d 20 h');
  assert.equal(shortDuePhrase(ahead, en), 'in 3 d 20 h');

  // A moment that is now says so, and an empty value says nothing.
  assert.equal(shortDuePhrase(new Date().toISOString(), es), 'Ahora');
  assert.equal(shortDuePhrase(null, es), '');
});

test('the short duration drops the parts that do not fit', () => {
  assert.equal(formatDurationShort(90, es), '1 h 30 min');
  assert.equal(formatDurationShort(60 * 30, es), '1 d 6 h');
  assert.equal(formatDurationShort(5, es), '5 min');
});
