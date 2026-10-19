import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuick, presetStart } from './quick';

/** Saturday 26 September 2026 at 17:00, the reference moment of the suite. */
const now = new Date(2026, 8, 26, 17, 0, 0);
/** Monday 28 September 2026 at 10:00, used for the weekday rules. */
const monday = new Date(2026, 8, 28, 10, 0, 0);
/** Monday 28 September 2026 at 08:00, used when today is still ahead. */
const mondayEarly = new Date(2026, 8, 28, 8, 0, 0);

function stamp(date: Date | null): string {
  if (!date) return 'none';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

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

test('English "on monday" is a single day and not a repeat', () => {
  const parsed = parseQuick('Dentist on monday at 3pm', now);
  assert.equal(parsed.title, 'Dentist');
  assert.equal(parsed.recurrence, null);
  assert.equal(stamp(parsed.start), '2026-09-28 15:00');
});

test('English "on Tuesday" is a single day and not a repeat', () => {
  const parsed = parseQuick('Call mom on Tuesday', now);
  assert.equal(parsed.title, 'Call mom');
  assert.equal(parsed.recurrence, null);
  assert.equal(stamp(parsed.start), '2026-09-29 09:00');
});

test('an explicit today is kept even when the hour has passed', () => {
  const parsed = parseQuick('hoy a las 3', now);
  assert.equal(stamp(parsed.start), '2026-09-26 15:00');
});

test('a bare hour means the same thing with and without a day word', () => {
  const bare = parseQuick('Llamar a las 9', now);
  const withDay = parseQuick('Llamar mañana a las 9', now);
  assert.equal(stamp(bare.start), '2026-09-27 09:00');
  assert.equal(stamp(withDay.start), stamp(bare.start));
});

test('the hour is read wherever it sits in the sentence', () => {
  const parsed = parseQuick('Llamar a las 10 mañana', now);
  assert.equal(parsed.title, 'Llamar');
  assert.equal(stamp(parsed.start), '2026-09-27 10:00');
});

test('a marked hour is read wherever it sits in the sentence', () => {
  const parsed = parseQuick('Dentist 3pm tomorrow', now);
  assert.equal(parsed.title, 'Dentist');
  assert.equal(stamp(parsed.start), '2026-09-27 15:00');
});

test('a day and a time are combined in any order', () => {
  const parsed = parseQuick('Pay rent in 3 days at 5pm', now);
  assert.equal(parsed.title, 'Pay rent');
  assert.equal(stamp(parsed.start), '2026-09-29 17:00');
});

test('a time of day word turns a plain hour into an afternoon hour', () => {
  const parsed = parseQuick('Dentist tomorrow at 3 in the afternoon', now);
  assert.equal(parsed.title, 'Dentist');
  assert.equal(stamp(parsed.start), '2026-09-27 15:00');
});

test('the filler words of a day expression stay out of the title', () => {
  const parsed = parseQuick('el próximo lunes', now);
  assert.equal(parsed.title, '');
  assert.equal(stamp(parsed.start), '2026-09-28 09:00');
});

test('the English filler words of a day expression stay out of the title', () => {
  const parsed = parseQuick('Dentist next Monday', now);
  assert.equal(parsed.title, 'Dentist');
  assert.equal(stamp(parsed.start), '2026-09-28 09:00');
});

test('next Monday skips today when today is Monday', () => {
  const parsed = parseQuick('Dentist next Monday', monday);
  assert.equal(stamp(parsed.start), '2026-10-05 09:00');
});

test('a plain Monday is today when the hour is still ahead', () => {
  const parsed = parseQuick('Dentist Monday', mondayEarly);
  assert.equal(stamp(parsed.start), '2026-09-28 09:00');
});

test('a plain Monday moves to the next Monday once the hour has passed', () => {
  const parsed = parseQuick('Dentist Monday', monday);
  assert.equal(stamp(parsed.start), '2026-10-05 09:00');
});

test('a bare number is not a time', () => {
  const parsed = parseQuick('buy 3 apples', now);
  assert.equal(parsed.title, 'Buy 3 apples');
  assert.equal(parsed.start, null);
});

test('a bare number is not a time in Spanish either', () => {
  const parsed = parseQuick('Comprar 3 manzanas', now);
  assert.equal(parsed.title, 'Comprar 3 manzanas');
  assert.equal(parsed.start, null);
});

test('a number after "a las" is a time', () => {
  const parsed = parseQuick('Llamar mañana a las 3', now);
  assert.equal(stamp(parsed.start), '2026-09-27 15:00');
});

test('a number after "at" is a time', () => {
  const parsed = parseQuick('Dentist tomorrow at 3', now);
  assert.equal(stamp(parsed.start), '2026-09-27 15:00');
});

test('a number after "from" is a time', () => {
  const parsed = parseQuick('Dentist tomorrow from 3pm', now);
  assert.equal(stamp(parsed.start), '2026-09-27 15:00');
});

test('a number with a colon is a time', () => {
  const parsed = parseQuick('Dentist tomorrow 15:30', now);
  assert.equal(stamp(parsed.start), '2026-09-27 15:30');
});

test('a number with a colon after a preposition keeps the minutes', () => {
  const parsed = parseQuick('Llamar mañana a las 10:30', now);
  assert.equal(stamp(parsed.start), '2026-09-27 10:30');
});

test('a written meridian is honoured exactly', () => {
  assert.equal(stamp(parseQuick('Llamar mañana 3pm', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 pm', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3p.m.', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 9am', now).start), '2026-09-27 09:00');
  assert.equal(stamp(parseQuick('Llamar mañana 9 a.m.', now).start), '2026-09-27 09:00');
  assert.equal(stamp(parseQuick('Llamar mañana 12am', now).start), '2026-09-27 00:00');
  assert.equal(stamp(parseQuick('Llamar mañana 12pm', now).start), '2026-09-27 12:00');
});

test('a time of day word after a number sets the meridian', () => {
  assert.equal(stamp(parseQuick('Llamar mañana 3 in the afternoon', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 in the morning', now).start), '2026-09-27 03:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 in the evening', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 de la tarde', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 por la tarde', now).start), '2026-09-27 15:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 de la mañana', now).start), '2026-09-27 03:00');
  assert.equal(stamp(parseQuick('Llamar mañana 3 por la mañana', now).start), '2026-09-27 03:00');
});

test('an hour without a meridian follows the business hours rule', () => {
  assert.equal(stamp(parseQuick('Llamar mañana a las 1', now).start), '2026-09-27 13:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 6', now).start), '2026-09-27 18:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 7', now).start), '2026-09-27 07:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 11', now).start), '2026-09-27 11:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 12', now).start), '2026-09-27 12:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 13', now).start), '2026-09-27 13:00');
  assert.equal(stamp(parseQuick('Llamar mañana a las 23', now).start), '2026-09-27 23:00');
});

test('today and tomorrow are read in both languages', () => {
  assert.equal(stamp(parseQuick('Llamar hoy', now).start), '2026-09-26 09:00');
  assert.equal(stamp(parseQuick('Llamar today', now).start), '2026-09-26 09:00');
  assert.equal(stamp(parseQuick('Llamar mañana', now).start), '2026-09-27 09:00');
  assert.equal(stamp(parseQuick('Llamar tomorrow', now).start), '2026-09-27 09:00');
});

test('the day after tomorrow is read in both languages', () => {
  assert.equal(stamp(parseQuick('Llamar pasado mañana', now).start), '2026-09-28 09:00');
  assert.equal(stamp(parseQuick('Llamar day after tomorrow', now).start), '2026-09-28 09:00');
});

test('tonight and this afternoon have a fixed hour', () => {
  assert.equal(stamp(parseQuick('Llamar esta noche', now).start), '2026-09-26 21:00');
  assert.equal(stamp(parseQuick('Llamar tonight', now).start), '2026-09-26 21:00');
  assert.equal(stamp(parseQuick('Llamar esta tarde', now).start), '2026-09-26 18:00');
  assert.equal(stamp(parseQuick('Llamar this afternoon', now).start), '2026-09-26 18:00');
  assert.equal(stamp(parseQuick('Llamar this evening', now).start), '2026-09-26 18:00');
});

test('a weekday name is read in both languages', () => {
  assert.equal(stamp(parseQuick('Llamar el lunes', now).start), '2026-09-28 09:00');
  assert.equal(stamp(parseQuick('Llamar on Monday', now).start), '2026-09-28 09:00');
  assert.equal(stamp(parseQuick('Llamar lunes', now).start), '2026-09-28 09:00');
  assert.equal(stamp(parseQuick('Llamar monday', now).start), '2026-09-28 09:00');
});

test('a day offset is read in both languages', () => {
  assert.equal(stamp(parseQuick('Llamar en 3 días', now).start), '2026-09-29 09:00');
  assert.equal(stamp(parseQuick('Llamar in 3 days', now).start), '2026-09-29 09:00');
});

test('the relative phrases keep working', () => {
  assert.equal(stamp(parseQuick('Llamar en 10 minutos', now).start), '2026-09-26 17:10');
  assert.equal(stamp(parseQuick('Llamar in 10 minutes', now).start), '2026-09-26 17:10');
  assert.equal(stamp(parseQuick('Llamar en media hora', now).start), '2026-09-26 17:30');
  assert.equal(stamp(parseQuick('Llamar in half an hour', now).start), '2026-09-26 17:30');
  assert.equal(stamp(parseQuick('Llamar en 2 horas', now).start), '2026-09-26 19:00');
  assert.equal(stamp(parseQuick('Llamar in an hour', now).start), '2026-09-26 18:00');
});

test('the repeat phrases keep working', () => {
  const every = parseQuick('Llamar cada 30 días', now);
  assert.equal(every.recurrence?.freq, 'daily');
  assert.equal(every.recurrence?.interval, 30);

  const month = parseQuick('Llamar cada mes', now);
  assert.equal(month.recurrence?.freq, 'monthly');
  assert.equal(month.recurrence?.dayOfMonth, 26);

  const spanishWeek = parseQuick('Llamar todos los lunes', now);
  assert.equal(spanishWeek.recurrence?.freq, 'weekly');

  const englishWeek = parseQuick('Llamar every Monday', now);
  assert.equal(englishWeek.recurrence?.freq, 'weekly');

  const spanishMonth = parseQuick('Llamar el 15 de cada mes', now);
  assert.equal(spanishMonth.recurrence?.dayOfMonth, 15);

  const englishMonth = parseQuick('Llamar the 15th of every month', now);
  assert.equal(englishMonth.recurrence?.dayOfMonth, 15);

  const spanishUntil = parseQuick('Llamar cada día hasta 2026-12-31', now);
  assert.equal(spanishUntil.recurrence?.until, '2026-12-31');

  const englishUntil = parseQuick('Llamar every day until 2026-12-31', now);
  assert.equal(englishUntil.recurrence?.until, '2026-12-31');
});

test('the leading filler words stay out of the title', () => {
  assert.equal(parseQuick('recordarme llamar mañana a las 9', now).title, 'Llamar');
  assert.equal(parseQuick('remind me to call mom tomorrow at 9am', now).title, 'Call mom');
  assert.equal(parseQuick('Tarea: llamar a las 9', now).title, 'Llamar');
  assert.equal(parseQuick('recordar llamar el lunes', now).title, 'Llamar');
});

test('a decimal time is read as a time and not as a number', () => {
  const decimal = parseQuick('3.30pm', now);
  assert.equal(decimal.start?.getHours(), 15);
  assert.equal(decimal.start?.getMinutes(), 30);
  assert.equal(decimal.title, '');

  const spaced = parseQuick('3.30 pm', now);
  assert.equal(spaced.start?.getHours(), 15);
  assert.equal(spaced.start?.getMinutes(), 30);

  const withSubject = parseQuick('Dentist 3.30pm tomorrow', now);
  assert.equal(withSubject.title, 'Dentist');
  assert.equal(withSubject.start?.getHours(), 15);
  assert.equal(withSubject.start?.getMinutes(), 30);
});

test('an impossible hour is left in the text', () => {
  const result = parseQuick('30pm', now);
  assert.equal(result.title, '30pm');
  assert.equal(result.start, null);
});

test('a number that is not a time stays in the title', () => {
  const kilos = parseQuick('buy 3.5kg of flour', now);
  assert.equal(kilos.title, 'Buy 3.5kg of flour');
  assert.equal(kilos.start, null);

  const apples = parseQuick('comprar 3 manzanas', now);
  assert.equal(apples.title, 'Comprar 3 manzanas');
  assert.equal(apples.start, null);

  const money = parseQuick('pay $5 on friday', now);
  assert.equal(money.title, 'Pay $5');
  assert.equal(money.start?.getDay(), 5);
});

test('the words around a monthly day stay out of the title', () => {
  const spanish = parseQuick('reunion el dia 15 de cada mes', now);
  assert.equal(spanish.title, 'Reunion');
  assert.equal(spanish.recurrence?.dayOfMonth, 15);

  const english = parseQuick('meeting the 15th of every month', now);
  assert.equal(english.title, 'Meeting');
  assert.equal(english.recurrence?.dayOfMonth, 15);
});
