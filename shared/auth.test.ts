import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { hashSecret, normalizeAuthSecret, verifySecret } from './auth';

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

test('a secret is verified against its own hash', async () => {
  const hash = await hashSecret('hunter2');
  assert.equal(await verifySecret('hunter2', hash), true);
  assert.equal(await verifySecret('hunter3', hash), false);
});

test('two hashes of the same secret are different', async () => {
  const first = await hashSecret('hunter2');
  const second = await hashSecret('hunter2');
  assert.notEqual(first, second);
  assert.equal(await verifySecret('hunter2', first), true);
  assert.equal(await verifySecret('hunter2', second), true);
});

test('a damaged hash never unlocks anything', async () => {
  // The key length used to come from the stored value, so an empty key
  // compared equal to itself and accepted any password.
  const damaged = [
    'scrypt$16384$8$1$$',
    'scrypt$16384$8$1$!!!!$!!!!',
    'scrypt$16384$8$1$AAAA$',
    'scrypt$16384$8$1$',
    'scrypt$16384$8$1$AAAA$AAAA',
    'scrypt$16384$8$1$AAAA$AAAA$AAAA',
    'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA',
    'not-a-hash',
    '',
  ];
  for (const hash of damaged) {
    assert.equal(await verifySecret('hunter2', hash), false, `hash accepted: ${hash}`);
    assert.equal(await verifySecret('', hash), false, `hash accepted: ${hash}`);
  }
});

test('a hash with different parameters is refused', async () => {
  const hash = await hashSecret('hunter2');
  const parts = hash.split('$');
  const weakened = `scrypt$1024$8$1$${parts[4]}$${parts[5]}`;
  assert.equal(await verifySecret('hunter2', weakened), false);
});

test('a hash from an alpha build still unlocks', async () => {
  const legacy = await bcrypt.hash('hunter2', 10);
  assert.equal(await verifySecret('hunter2', legacy, (value, hash) => bcrypt.compare(value, hash)), true);
  assert.equal(await verifySecret('wrong', legacy, (value, hash) => bcrypt.compare(value, hash)), false);
});

test('no stored hash means no access', async () => {
  assert.equal(await verifySecret('hunter2', null), false);
  assert.equal(await verifySecret('hunter2', undefined as unknown as string), false);
});
