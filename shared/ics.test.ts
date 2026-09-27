import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIcs } from './ics';

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260927T100000
DTEND:20260927T110000
SUMMARY:Team meeting
DESCRIPTION:Weekly sync\\, bring notes
BEGIN:VALARM
TRIGGER:-PT15M
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART;VALUE=DATE:20260928
DTEND;VALUE=DATE:20260929
SUMMARY:Holiday
END:VEVENT
BEGIN:VEVENT
UID:3
DTSTART:20260927T090000Z
SUMMARY:Flight
RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231
END:VEVENT
END:VCALENDAR`;

test('a timed event keeps its hours and alarm', () => {
  const [first] = parseIcs(SAMPLE);
  assert.equal(first.draft.title, 'Team meeting');
  assert.ok(first.draft.startLocal?.endsWith('T10:00'));
  assert.equal(first.draft.endLocal?.slice(-5), '11:00');
  assert.equal(first.draft.remindMinutes, 15);
  assert.equal(first.draft.notes, 'Weekly sync, bring notes');
});

test('a date-only event becomes all day without an end', () => {
  const [, second] = parseIcs(SAMPLE);
  assert.equal(second.draft.allDay, true);
  assert.equal(second.draft.startLocal, '2026-09-28');
  assert.equal(second.draft.endLocal, null);
});

test('a UTC stamp with recurrence maps to local time and a rule', () => {
  const [, , third] = parseIcs(SAMPLE);
  assert.equal(third.draft.recurrence?.freq, 'weekly');
  assert.equal(third.draft.recurrence?.interval, 2);
  assert.equal(third.draft.recurrence?.until, '2026-12-31');
});

test('folded lines are unfolded before parsing', () => {
  const folded = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260927T100000\nSUMMARY:Long ti\n tle here\nEND:VEVENT\nEND:VCALENDAR';
  const [event] = parseIcs(folded);
  assert.equal(event.draft.title, 'Long title here');
});

test('an event without a title is rejected', () => {
  assert.throws(() => parseIcs('BEGIN:VEVENT\nDTSTART:20260927T100000\nEND:VEVENT'), /SUMMARY/);
});
