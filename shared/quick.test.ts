import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuick, presetStart } from './quick';

const now = new Date(2026, 8, 26, 17, 0, 0);

test('Farmacia en 10 minutos is a task ten minutes ahead', () => {
  const parsed = parseQuick('Farmacia en 10 minutos', now);
  assert.equal(parsed.title, 'Farmacia');
  assert.equal(parsed.start?.getHours(), 17);
  assert.equal(parsed.start?.getMinutes(), 10);
});

test('english relative phrase works the same way', () => {
  const parsed = parseQuick('Pharmacy in 10 minutes', now);
  assert.equal(parsed.title, 'Pharmacy');
  assert.equal(parsed.start?.getMinutes(), 10);
});

test('tomorrow at 9 keeps the title', () => {
  const parsed = parseQuick('Llamar mañana a las 9', now);
  assert.equal(parsed.title, 'Llamar');
  assert.equal(parsed.start?.getDate(), 27);
  assert.equal(parsed.start?.getHours(), 9);
});

test('a bare subject has no date', () => {
  const parsed = parseQuick('Pagar renta', now);
  assert.equal(parsed.title, 'Pagar renta');
  assert.equal(parsed.start, null);
});

test('3pm tomorrow is 15:00', () => {
  const parsed = parseQuick('Dentist tomorrow at 3pm', now);
  assert.equal(parsed.title, 'Dentist');
  assert.equal(parsed.start?.getDate(), 27);
  assert.equal(parsed.start?.getHours(), 15);
});

test('weekday plus hour stays on that weekday', () => {
  const parsed = parseQuick('Banco el lunes a las 10', now);
  assert.equal(parsed.title, 'Banco');
  assert.equal(parsed.start?.getDate(), 28);
  assert.equal(parsed.start?.getHours(), 10);
});

test('saturday evening rolls lunes to monday at 9', () => {
  const parsed = parseQuick('Banco el lunes', now);
  assert.equal(parsed.title, 'Banco');
  assert.equal(parsed.start?.getDay(), 1);
  assert.equal(parsed.start?.getHours(), 9);
});

test('tonight preset is 21:00 when it is still early', () => {
  const start = presetStart('tonight', new Date(2026, 8, 26, 16, 0, 0));
  assert.equal(start.getHours(), 21);
  assert.equal(start.getDate(), 26);
});

test('Spanish interval words create a daily recurrence', () => {
  const parsed = parseQuick('Pagar el agua cada treinta días a las 9', now);
  assert.equal(parsed.title, 'Pagar el agua');
  assert.deepEqual(parsed.recurrence, { freq: 'daily', interval: 30, until: null });
  assert.equal(parsed.start?.getDate(), 26);
  assert.equal(parsed.start?.getMonth(), 9);
  assert.equal(parsed.start?.getHours(), 9);
});

test('a Spanish day of month keeps its monthly anchor', () => {
  const parsed = parseQuick('Ir al super los quince de cada mes', now);
  assert.equal(parsed.title, 'Ir al super');
  assert.deepEqual(parsed.recurrence, { freq: 'monthly', interval: 1, until: null, dayOfMonth: 15 });
  assert.equal(parsed.start?.getDate(), 15);
  assert.equal(parsed.start?.getMonth(), 9);
});

test('English weekdays and until dates are supported', () => {
  const parsed = parseQuick('Take bins every monday at 8am until 2026-12-31', now);
  assert.equal(parsed.title, 'Take bins');
  assert.deepEqual(parsed.recurrence, { freq: 'weekly', interval: 1, until: '2026-12-31' });
  assert.equal(parsed.start?.getDay(), 1);
  assert.equal(parsed.start?.getHours(), 8);
});
