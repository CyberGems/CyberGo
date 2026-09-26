import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuthSecret } from './auth';

test('a PIN is 4 to 8 digits', () => {
  assert.equal(normalizeAuthSecret('1234', 'pin'), '1234');
  assert.equal(normalizeAuthSecret(' 12345678 ', 'pin'), '12345678');
  assert.equal(normalizeAuthSecret('123', 'pin'), null);
  assert.equal(normalizeAuthSecret('123456789', 'pin'), null);
  assert.equal(normalizeAuthSecret('12ab', 'pin'), null);
});

test('a password stays free text and needs 4 characters', () => {
  assert.equal(normalizeAuthSecret('ab12', 'password'), 'ab12');
  assert.equal(normalizeAuthSecret('abc', 'password'), null);
});
