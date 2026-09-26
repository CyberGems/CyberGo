import assert from 'node:assert/strict';
import test from 'node:test';
import { afterDismiss, buildSchedule, isDue, nextDate, parseLocal, tomorrowAtNine } from './schedule';
import type { Item, Recurrence } from './types';

function item(partial: Partial<Item>): Item {
  return {
    id: '1',
    kind: 'event',
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

test('all-day date stays on the chosen local day', () => {
  const d = parseLocal('2026-11-06', true);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 6);
  assert.equal(d.getHours(), 9);
});

test('remind fires before the occurrence', () => {
  const schedule = buildSchedule({
    startLocal: '2026-11-06T10:00',
    endLocal: null,
    allDay: false,
    remindMinutes: 15,
  });
  const start = new Date(schedule.startAt!).getTime();
  const fire = new Date(schedule.nextFireAt!).getTime();
  assert.equal(start - fire, 15 * 60_000);
});

test('daily recurrence advances one day and stops at until', () => {
  const rec: Recurrence = { freq: 'daily', interval: 1, until: '2026-05-02' };
  const first = parseLocal('2026-05-01T09:00', false);
  const second = nextDate(first, rec);
  assert.equal(second?.getDate(), 2);
  const third = nextDate(second!, rec);
  assert.equal(third, null);
});

test('dismiss of a monthly item moves to the next month', () => {
  const current = item({
    occurrenceAt: new Date(2026, 0, 6, 9, 0, 0).toISOString(),
    nextFireAt: new Date(2026, 0, 6, 9, 0, 0).toISOString(),
    remindMinutes: 0,
    recurrence: { freq: 'monthly', interval: 1, until: null },
  });
  const next = afterDismiss(current);
  const when = new Date(next.occurrenceAt!);
  assert.equal(when.getMonth(), 1);
  assert.equal(when.getDate(), 6);
  assert.equal(next.alertKey, null);
});

test('a dismissed one-off is not due', () => {
  const done = item({
    nextFireAt: new Date(Date.now() - 1000).toISOString(),
    alertKey: 'dismissed',
  });
  assert.equal(isDue(done, Date.now()), false);
});

test('tomorrow at nine is the next calendar morning', () => {
  const now = new Date(2026, 8, 25, 22, 0, 0);
  const t = new Date(tomorrowAtNine(now));
  assert.equal(t.getDate(), 26);
  assert.equal(t.getHours(), 9);
});
