import assert from 'node:assert/strict';
import test from 'node:test';
import { computeStats } from './stats';

function isoDaysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

test('consecutive recent days build a streak', () => {
  const stats = computeStats([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(1), isoDaysAgo(2)]);
  assert.equal(stats.streak, 3);
  assert.equal(stats.doneToday, 1);
  assert.equal(stats.doneWeek, 4);
});

test('a streak stays alive when today is still empty', () => {
  const stats = computeStats([isoDaysAgo(1), isoDaysAgo(2)]);
  assert.equal(stats.streak, 2);
  assert.equal(stats.doneToday, 0);
});

test('a gap breaks the streak', () => {
  const stats = computeStats([isoDaysAgo(0), isoDaysAgo(2)]);
  assert.equal(stats.streak, 1);
});

test('no completions means no streak', () => {
  const stats = computeStats([null, 'nope']);
  assert.equal(stats.streak, 0);
  assert.equal(stats.doneToday, 0);
  assert.equal(stats.doneWeek, 0);
});
