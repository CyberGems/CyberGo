import assert from 'node:assert/strict';
import test from 'node:test';
import { itemToCsvRow, parseCsv, rowToDraft, toCsv } from './csv';
import type { Group, Item } from './types';

const group: Group = {
  id: 'g1',
  name: 'Casa',
  color: '#6c63e6',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function item(): Item {
  return {
    id: '1',
    kind: 'event',
    title: 'Hosting, "pro"',
    notes: 'line\n2',
    allDay: false,
    startAt: new Date(2026, 10, 6, 9, 30).toISOString(),
    endAt: new Date(2026, 10, 6, 10, 0).toISOString(),
    importance: 'high',
    color: '#f59e0b',
    groupId: 'g1',
    recurrence: { freq: 'yearly', interval: 1, until: null },
    remindMinutes: 60,
    occurrenceAt: new Date(2026, 10, 6, 9, 30).toISOString(),
    nextFireAt: new Date(2026, 10, 6, 8, 30).toISOString(),
    snoozeUntil: null,
    alertKey: null,
    completedAt: null,
    deletedAt: null,
    remoteId: null,
    syncRev: 1,
    createdAt: '',
    updatedAt: '',
  };
}

test('csv roundtrip keeps commas, quotes and the group name', () => {
  const csv = toCsv([itemToCsvRow(item(), [group])]);
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Hosting, "pro"');
  assert.equal(rows[0].notes, 'line\n2');
  const { draft, newGroupName } = rowToDraft(rows[0], [group]);
  assert.equal(draft.groupId, 'g1');
  assert.equal(newGroupName, null);
  assert.equal(draft.recurrence?.freq, 'yearly');
  assert.equal(draft.importance, 'high');
  assert.equal(draft.remindMinutes, 60);
});

test('unknown group name is reported so the importer can create it', () => {
  const rows = parseCsv('kind,title,group\nevent,Respaldos,Trabajo\n');
  const { draft, newGroupName } = rowToDraft(rows[0], []);
  assert.equal(draft.title, 'Respaldos');
  assert.equal(newGroupName, 'Trabajo');
});
