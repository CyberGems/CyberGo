import assert from 'node:assert/strict';
import test from 'node:test';
import { afterDismiss, buildSchedule, isDue, nextDate, normalizeRecurrence, parseLocal, tomorrowAtNine } from './schedule';
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

test('monthly day anchors clamp short months and recover afterward', () => {
  const recurrence: Recurrence = { freq: 'monthly', interval: 1, until: null, dayOfMonth: 31 };
  const february = nextDate(new Date(2026, 0, 31, 9, 0, 0), recurrence);
  assert.equal(february?.getMonth(), 1);
  assert.equal(february?.getDate(), 28);
  const march = nextDate(february!, recurrence);
  assert.equal(march?.getMonth(), 2);
  assert.equal(march?.getDate(), 31);
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

test('a monthly recurrence without an anchor still returns to its own day', () => {
  // The anchor is what stops the series from settling on the 28th of February.
  const recurrence = normalizeRecurrence({ freq: 'monthly', interval: 1, until: null }, '2026-01-31T09:00');
  assert.equal(recurrence?.dayOfMonth, 31);
  const february = nextDate(new Date(2026, 0, 31, 9, 0, 0), recurrence!);
  assert.equal(february?.getMonth(), 1);
  assert.equal(february?.getDate(), 28);
  const march = nextDate(february!, recurrence!);
  assert.equal(march?.getMonth(), 2);
  assert.equal(march?.getDate(), 31);
});

test('a yearly recurrence keeps February for a leap day', () => {
  const recurrence = normalizeRecurrence({ freq: 'yearly', interval: 1, until: null }, '2028-02-29T09:00');
  assert.equal(recurrence?.dayOfMonth, 29);
  const next = nextDate(new Date(2028, 1, 29, 9, 0, 0), recurrence!);
  assert.equal(next?.getFullYear(), 2029);
  assert.equal(next?.getMonth(), 1);
  assert.equal(next?.getDate(), 28);
  const later = nextDate(next!, recurrence!);
  assert.equal(later?.getFullYear(), 2030);
  assert.equal(later?.getMonth(), 1);
  assert.equal(later?.getDate(), 28);
  // 2031 is not a leap year, 2032 is.
  const plain = nextDate(later!, recurrence!);
  assert.equal(plain?.getFullYear(), 2031);
  assert.equal(plain?.getMonth(), 1);
  assert.equal(plain?.getDate(), 28);
  const leap = nextDate(plain!, recurrence!);
  assert.equal(leap?.getFullYear(), 2032);
  assert.equal(leap?.getMonth(), 1);
  assert.equal(leap?.getDate(), 29);
});

test('normalizeRecurrence drops a malformed end date and clamps the interval', () => {
  const recurrence = normalizeRecurrence({ freq: 'daily', interval: 0, until: '31/12/2026' }, null);
  assert.equal(recurrence?.interval, 1);
  assert.equal(recurrence?.until, null);
});

test('normalizeRecurrence leaves a daily rule without an anchor', () => {
  const recurrence = normalizeRecurrence({ freq: 'daily', interval: 2, until: null }, '2026-01-31T09:00');
  assert.equal(recurrence?.dayOfMonth, null);
  assert.equal(recurrence?.interval, 2);
});

test('a weekly recurrence advances by whole weeks', () => {
  const recurrence: Recurrence = { freq: 'weekly', interval: 1, until: null };
  const next = nextDate(new Date(2026, 8, 30, 9, 0, 0), recurrence);
  assert.equal(next?.getDate(), 7);
  assert.equal(next?.getMonth(), 9);
});

test('an interval longer than one skips the right number of days', () => {
  const recurrence: Recurrence = { freq: 'daily', interval: 3, until: null };
  const next = nextDate(new Date(2026, 8, 30, 9, 0, 0), recurrence);
  assert.equal(next?.getDate(), 3);
  assert.equal(next?.getMonth(), 9);
});

test('an occurrence that lands exactly on the end date is still included', () => {
  const recurrence: Recurrence = { freq: 'daily', interval: 1, until: '2026-10-03' };
  const next = nextDate(new Date(2026, 9, 2, 9, 0, 0), recurrence);
  assert.ok(next);
  assert.equal(next?.getMonth(), 9);
  assert.equal(next?.getDate(), 3);
  const past = nextDate(next!, recurrence);
  assert.equal(past, null);
});

test('a local date with impossible components is rejected', () => {
  assert.throws(() => parseLocal('2026-13-45', false));
  assert.throws(() => parseLocal('2026-02-30T10:00', false));
  assert.throws(() => parseLocal('2026-01-01T25:00', false));
});

test('a two digit year is not read as nineteen hundred', () => {
  const d = parseLocal('0099-05-04', false);
  assert.equal(d.getFullYear(), 99);
});

test('dismissing a recurring item recomputes the fire time with the reminder offset', () => {
  const current = item({
    occurrenceAt: new Date(2026, 0, 6, 9, 0, 0).toISOString(),
    nextFireAt: new Date(2026, 0, 6, 8, 45, 0).toISOString(),
    remindMinutes: 15,
    recurrence: { freq: 'monthly', interval: 1, until: null, dayOfMonth: 6 },
  });
  const next = afterDismiss(current);
  const occurrence = new Date(next.occurrenceAt!);
  const fire = new Date(next.nextFireAt!);
  assert.equal(occurrence.getMonth(), 1);
  assert.equal(occurrence.getDate(), 6);
  assert.equal(occurrence.getTime() - fire.getTime(), 15 * 60_000);
});

test('a time that is not a time is refused', () => {
  // The minute is not a number, so it cannot be read as midnight.
  assert.throws(() => parseLocal('2026-11-06T09:xx', false), /time/);
  assert.throws(() => parseLocal('2026-11-06T09:70', false), /time/);
  assert.throws(() => parseLocal('2026-11-06T25:00', false), /time/);
  assert.throws(() => parseLocal('2026-11-06T09:00:00', false), /time/);
  // A plain hour is still a time.
  assert.equal(parseLocal('2026-11-06T09', false).getHours(), 9);
});

test('an end date that does not exist is dropped', () => {
  const malformed = normalizeRecurrence({ freq: 'monthly', interval: 1, until: '2026-13-45', dayOfMonth: 5 }, '2026-01-05T10:00');
  assert.equal(malformed?.until, null);
  // The 29th of February only exists on a leap year.
  const leap = normalizeRecurrence({ freq: 'yearly', interval: 1, until: '2026-02-29', dayOfMonth: 29 }, '2028-02-29T10:00');
  assert.equal(leap?.until, null);
  const real = normalizeRecurrence({ freq: 'yearly', interval: 1, until: '2028-02-29', dayOfMonth: 29 }, '2028-02-29T10:00');
  assert.equal(real?.until, '2028-02-29');
});

test('a frequency nobody knows about is not guessed', () => {
  const unknown = normalizeRecurrence({ freq: 'hourly' as never, interval: 1, until: null }, '2026-01-05T10:00');
  assert.equal(unknown, null);
  assert.equal(nextDate(new Date(2026, 0, 5), { freq: 'hourly' as never, interval: 1, until: null }), null);
});
