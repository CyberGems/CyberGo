import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIcs } from './ics';

// A fixed zone keeps the local time assertions stable on any machine.
process.env.TZ = 'Europe/Madrid';

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

function oneEvent(body: string): { events: ReturnType<typeof parseIcs>['events']; errors: string[] } {
  return parseIcs(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', ...body.split('\n'), 'END:VEVENT', 'END:VCALENDAR'].join('\n'));
}

test('a timed event keeps its hours and alarm', () => {
  const { events, errors } = parseIcs(SAMPLE);
  assert.equal(errors.length, 0);
  const [first] = events;
  assert.equal(first.draft.title, 'Team meeting');
  assert.ok(first.draft.startLocal?.endsWith('T10:00'));
  assert.equal(first.draft.endLocal?.slice(-5), '11:00');
  assert.equal(first.draft.remindMinutes, 15);
  assert.equal(first.draft.notes, 'Weekly sync, bring notes');
});

test('a date-only event becomes all day without an end', () => {
  const { events } = parseIcs(SAMPLE);
  const [, second] = events;
  assert.equal(second.draft.allDay, true);
  assert.equal(second.draft.startLocal, '2026-09-28');
  assert.equal(second.draft.endLocal, null);
});

test('a UTC stamp with recurrence maps to local time and a rule', () => {
  const { events } = parseIcs(SAMPLE);
  const [, , third] = events;
  assert.equal(third.draft.recurrence?.freq, 'weekly');
  assert.equal(third.draft.recurrence?.interval, 2);
  assert.equal(third.draft.recurrence?.until, '2026-12-31');
});

test('folded lines are unfolded before parsing', () => {
  const folded = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260927T100000\nSUMMARY:Long ti\n tle here\nEND:VEVENT\nEND:VCALENDAR';
  const { events } = parseIcs(folded);
  const [event] = events;
  assert.equal(event.draft.title, 'Long title here');
});

test('an event without a title is rejected', () => {
  const { events, errors } = parseIcs('BEGIN:VEVENT\nDTSTART:20260927T100000\nEND:VEVENT');
  assert.equal(events.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /SUMMARY/);
});

test('a broken event does not stop the import of the other events', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART:20260927T100000',
    'SUMMARY:Good one',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:2026-09-28T10:00:00',
    'SUMMARY:Bad date',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  const { events, errors } = parseIcs(ics);
  assert.equal(events.length, 1);
  assert.equal(events[0].draft.title, 'Good one');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^event 2:/);
  assert.match(errors[0], /DTSTART/);
});

test('an event without a start is rejected', () => {
  const { events, errors } = parseIcs('BEGIN:VEVENT\nSUMMARY:No start\nEND:VEVENT');
  assert.equal(events.length, 0);
  assert.match(errors[0], /DTSTART/);
});

test('an end before the start is rejected', () => {
  const { events, errors } = oneEvent('DTSTART:20260927T100000\nDTEND:20260927T090000\nSUMMARY:Backwards');
  assert.equal(events.length, 0);
  assert.match(errors[0], /end before start/);
});

test('a file without events gives one message and no event', () => {
  const { events, errors } = parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
  assert.equal(events.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no calendar events/);
});

test('a backslash before an n is read as text and not as a line break', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nSUMMARY:Path C:\\\\notes');
  assert.equal(events[0].draft.title, 'Path C:\\notes');
});

test('an escaped line break is decoded', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nSUMMARY:Line one\\nLine two');
  assert.equal(events[0].draft.title, 'Line one\nLine two');
});

test('a named zone is converted to the local time', () => {
  const { events } = oneEvent('DTSTART;TZID=Asia/Tokyo:20260927T100000\nSUMMARY:Tokyo');
  assert.equal(events[0].draft.startLocal, '2026-09-27T03:00');
  assert.equal(new Date(`${events[0].draft.startLocal}:00`).getTime(), Date.UTC(2026, 8, 27, 1, 0, 0));
});

test('an unknown zone keeps the time as local', () => {
  const { events } = oneEvent('DTSTART;TZID=Mars/Olympus:20260927T100000\nSUMMARY:Unknown zone');
  assert.equal(events[0].draft.startLocal, '2026-09-27T10:00');
});

test('a duration gives the end of the event', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nDURATION:PT1H30M\nSUMMARY:Duration');
  assert.equal(events[0].draft.startLocal, '2026-09-27T10:00');
  assert.equal(events[0].draft.endLocal, '2026-09-27T11:30');
});

test('a duration of weeks gives the end of the event', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nDURATION:P2W\nSUMMARY:Fortnight');
  assert.equal(events[0].draft.endLocal, '2026-10-11T10:00');
});

test('an end date wins over a duration', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nDTEND:20260927T120000\nDURATION:PT1H\nSUMMARY:Both');
  assert.equal(events[0].draft.endLocal, '2026-09-27T12:00');
});

test('a counted rule ends on the last occurrence', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=DAILY;COUNT=3\nSUMMARY:Counted');
  assert.equal(events[0].draft.recurrence?.until, '2026-09-29');
});

test('a counted monthly rule keeps the day of the start', () => {
  const { events } = oneEvent('DTSTART:20260131T100000\nRRULE:FREQ=MONTHLY;COUNT=3\nSUMMARY:Monthly');
  assert.equal(events[0].draft.recurrence?.dayOfMonth, 31);
  assert.equal(events[0].draft.recurrence?.until, '2026-03-31');
});

test('a counted rule loses to an end date', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=DAILY;COUNT=3;UNTIL=20261001\nSUMMARY:Both');
  assert.equal(events[0].draft.recurrence?.until, '2026-10-01');
});

test('a day of the month is read from the rule', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=15\nSUMMARY:Anchor');
  assert.equal(events[0].draft.recurrence?.dayOfMonth, 15);
});

test('a monthly rule without a day of the month takes the day of the start', () => {
  const { events } = oneEvent('DTSTART:20260131T100000\nRRULE:FREQ=MONTHLY\nSUMMARY:No anchor');
  assert.equal(events[0].draft.recurrence?.dayOfMonth, 31);
});

test('a weekday of the rule moves the start onto that weekday', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=WEEKLY;BYDAY=MO\nSUMMARY:Monday');
  assert.equal(events[0].draft.startLocal, '2026-09-28T10:00');
});

test('the ordinal of a weekday is ignored', () => {
  const { events } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=WEEKLY;BYDAY=2MO\nSUMMARY:Second Monday');
  assert.equal(events[0].draft.startLocal, '2026-09-28T10:00');
});

test('a rule with several weekdays keeps the first one and says so', () => {
  const { events, errors } = oneEvent('DTSTART:20260927T100000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\nSUMMARY:Two days');
  assert.equal(events[0].draft.startLocal, '2026-09-28T10:00');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /only the first/);
});

test('an end date in UTC keeps its UTC day', () => {
  const { events } = oneEvent('DTSTART:20260927T100000Z\nRRULE:FREQ=DAILY;UNTIL=20261231T235959Z\nSUMMARY:End');
  assert.equal(events[0].draft.recurrence?.until, '2026-12-31');
});
