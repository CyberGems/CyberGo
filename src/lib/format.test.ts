import assert from 'node:assert/strict';
import test from 'node:test';
import { duePhrase, formatDuration, overduePhrase } from './format';

test('formats elapsed time with useful mixed units', () => {
  assert.equal(formatDuration(1, 'es'), '1 min');
  assert.equal(formatDuration(65, 'es'), '1 h 5 min');
  assert.equal(formatDuration(1_500, 'es'), '1 día 1 h');
  assert.equal(formatDuration(65, 'en'), '1 h 5 min');
});

test('uses the same friendly overdue duration for panel and reminders', () => {
  const overdue = new Date(Date.now() - (2 * 60 + 5) * 60_000).toISOString();
  assert.match(overduePhrase(overdue, 'es'), /^Vencido hace 2 h 5 min$/);
  assert.match(duePhrase(overdue, 'en'), /^Overdue by 2 h 5 min$/);
});
