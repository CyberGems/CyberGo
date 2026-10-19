import assert from 'node:assert/strict';
import test from 'node:test';
import { CSV_HEADERS, detectCsvFormat, itemToCsvRow, parseCsv, rowToDraft, sanitizeColor, toCsv } from './csv';
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

/** A full row, so a test only has to name the columns it cares about. */
function row(values: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {};
  for (const header of CSV_HEADERS) base[header] = '';
  return { ...base, ...values };
}

/** The local wall clock of a moment, the way CyberGo stores it. */
function localStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
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

test('legacy calendar CSV rows are imported with dates, reminders and recurrence', () => {
  const csv = [
    '"Start Date","Start Time","End Date","End Time","Reminder On/Off","Reminder Date","Reminder Time",Recurrence,Importance,Subject,Location,Comment,Group',
    '27/09/2026,"9:30 AM",27/09/2026,"2:00 PM",Yes,27/09/2026,"9:00 AM","every day effective 25/02/2024 from 9:30 AM to 2:00 PM.",Normal,"TOMAR SOL",,, "Default Group"',
  ].join('\n');
  const rows = parseCsv(csv);
  assert.equal(detectCsvFormat(rows), 'legacy');
  const { draft, newGroupName } = rowToDraft(rows[0], []);
  assert.equal(draft.title, 'TOMAR SOL');
  assert.equal(draft.startLocal, '2026-09-27T09:30');
  assert.equal(draft.endLocal, '2026-09-27T14:00');
  assert.equal(draft.recurrence?.freq, 'daily');
  assert.equal(draft.remindMinutes, 30);
  assert.equal(newGroupName, 'Default Group');
});

test('legacy all-day rows and monthly day are preserved', () => {
  const csv = [
    '"Start Date","Start Time","End Date","End Time","Reminder On/Off","Reminder Date","Reminder Time",Recurrence,Importance,Subject,Location,Comment,Group',
    '30/09/2026,"12:00 AM",1/10/2026,"12:00 AM",Yes,28/09/2026,"12:00 AM","the 30th of every month effective 30/04/2024.",Normal,"RESPALDO DISTRI",,, "Default Group"',
  ].join('\n');
  const rows = parseCsv(csv);
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.allDay, true);
  assert.equal(draft.startLocal, '2026-09-30');
  assert.equal(draft.endLocal, '2026-10-01');
  assert.equal(draft.recurrence?.freq, 'monthly');
  assert.equal(draft.recurrence?.dayOfMonth, 30);
  assert.equal(draft.remindMinutes, 2880);
});

test('a value that looks like a formula is neutralised on export and read back', () => {
  const csv = toCsv([row({ title: "=cmd|'/c calc'!A1" })]);
  assert.ok(csv.includes("'=cmd"), 'the exported cell starts with a quote');
  const rows = parseCsv(csv);
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.title, "=cmd|'/c calc'!A1");
});

test('every formula trigger is neutralised on export', () => {
  for (const value of ['=1+1', '+1', '-1', '@sum(A1)']) {
    const csv = toCsv([row({ title: value })]);
    const rows = parseCsv(csv);
    const { draft } = rowToDraft(rows[0], []);
    assert.equal(draft.title, value, `the value ${JSON.stringify(value)} survives the round trip`);
  }
  // A tab also makes a spreadsheet read a cell as a formula.
  const csv = toCsv([row({ title: 'Tabbed', notes: '\tvalue' })]);
  assert.ok(csv.includes("'\tvalue"), 'the exported cell starts with a quote');
  const rows = parseCsv(csv);
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.notes, '\tvalue');
});

test('a title that only starts with an apostrophe is kept', () => {
  const rows = parseCsv("kind,title\ntask,'quoted\n");
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.title, "'quoted");
});

test('a date without padding keeps its time', () => {
  const rows = parseCsv('kind,title,start_at\nevent,Short date,2026-9-7 10:30\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.startLocal, '2026-09-07T10:30');
  assert.equal(draft.allDay, false);
});

test('a time with seconds is accepted', () => {
  const rows = parseCsv('kind,title,start_at\nevent,Seconds,2026-09-07 10:30:00\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.startLocal, '2026-09-07T10:30');
});

test('a time in UTC is converted to the local time', () => {
  const rows = parseCsv('kind,title,start_at\nevent,Utc,2026-09-07T10:30:00Z\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.startLocal, localStamp(new Date(Date.UTC(2026, 8, 7, 10, 30))));
});

test('a time with an offset is converted to the local time', () => {
  const rows = parseCsv('kind,title,start_at\nevent,Offset,2026-09-07T10:30:00+02:00\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.startLocal, localStamp(new Date(Date.UTC(2026, 8, 7, 8, 30))));
});

test('a malformed end of a recurrence is rejected', () => {
  const rows = parseCsv('kind,title,start_at,recurrence_freq,recurrence_until\nevent,Bad until,2026-09-07 10:30,monthly,not-a-date\n');
  assert.throws(() => rowToDraft(rows[0], []), /recurrence/);
});

test('a valid end of a recurrence is kept', () => {
  const rows = parseCsv('kind,title,start_at,recurrence_freq,recurrence_until\nevent,Until,2026-09-07 10:30,monthly,2026-12-31\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.recurrence?.until, '2026-12-31');
});

test('a monthly rule without a day of the month takes the day of the start', () => {
  const rows = parseCsv('kind,title,start_at,recurrence_freq\nevent,Monthly,2026-01-31 09:00,monthly\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.recurrence?.dayOfMonth, 31);
});

test('a day of the month in the file wins over the day of the start', () => {
  const rows = parseCsv('kind,title,start_at,recurrence_freq,recurrence_day_of_month\nevent,Monthly,2026-01-31 09:00,monthly,15\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.recurrence?.dayOfMonth, 15);
});

test('an invalid day of the month falls back to the day of the start', () => {
  const rows = parseCsv('kind,title,start_at,recurrence_freq,recurrence_day_of_month\nevent,Monthly,2026-01-31 09:00,monthly,nonsense\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.recurrence?.dayOfMonth, 31);
});

test('a Windows line break inside a quoted field survives the round trip', () => {
  const notes = 'first line\r\nsecond line';
  const csv = toCsv([row({ title: 'Notes', notes })]);
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notes, notes);
});

test('a line break of any kind inside a quoted field is kept', () => {
  for (const notes of ['one\ntwo', 'one\r\ntwo', 'one\rtwo']) {
    const csv = toCsv([row({ title: 'Notes', notes })]);
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].notes, notes);
  }
});

test('a row with missing columns still imports as a task', () => {
  const rows = parseCsv('kind,title,start_at,end_at\nevent,Short row\n');
  assert.equal(rows.length, 1);
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.title, 'Short row');
  assert.equal(draft.startLocal, null);
  assert.equal(draft.endLocal, null);
});

test('a row with extra columns drops the extra cells', () => {
  const rows = parseCsv('kind,title,start_at\nevent,Long row,2026-09-07 10:30,extra,more\n');
  assert.equal(rows.length, 1);
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.title, 'Long row');
  assert.equal(draft.startLocal, '2026-09-07T10:30');
});

test('a row without a title is rejected', () => {
  const rows = parseCsv('kind,title,start_at\nevent,,2026-09-07 10:30\n');
  assert.throws(() => rowToDraft(rows[0], []), /missing title/);
});

test('a color that is not a hex code is dropped', () => {
  assert.equal(sanitizeColor('#a1B2c3'), '#a1B2c3');
  assert.equal(sanitizeColor('#abc'), '');
  assert.equal(sanitizeColor('red'), '');
  assert.equal(sanitizeColor('red; background:url(evil)'), '');
  assert.equal(sanitizeColor(''), '');
});

test('a crafted color in a row never reaches the item', () => {
  const rows = parseCsv('kind,title,color\nevent,Colored,expression(alert(1))\n');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.color, '');
});

test('a semicolon separated file is read', () => {
  const rows = parseCsv('kind;title;start_at\nevent;Semi colon;2026-09-07 10:30\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Semi colon');
  const { draft } = rowToDraft(rows[0], []);
  assert.equal(draft.startLocal, '2026-09-07T10:30');
});

test('a byte order mark is ignored', () => {
  const rows = parseCsv('\uFEFFkind,title,start_at\nevent,Bom,2026-09-07 10:30\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Bom');
  assert.equal(rows[0].kind, 'event');
});
