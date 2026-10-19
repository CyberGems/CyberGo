import assert from 'node:assert/strict';
import test from 'node:test';
import { enterTargetHandlesItself, resolveModalHandler, type ModalEntry } from './ModalKeys';

function entry(order: number, keys: ModalEntry['keys']): ModalEntry {
  return { order, keys };
}

test('a nested dialog wins over its parent even when it registered first', () => {
  const parent = entry(1, { esc: () => 'parent' });
  const child = entry(2, { esc: () => 'child' });
  // React flushes the effects of a child before the ones of its parent, so
  // the child is pushed onto the stack first.
  assert.equal(resolveModalHandler([child, parent], 'esc')?.(), 'child');
});

test('a dialog that opens later wins over one that was already open', () => {
  const open = entry(4, { esc: () => 'open' });
  const later = entry(9, { esc: () => 'later' });
  assert.equal(resolveModalHandler([open, later], 'esc')?.(), 'later');
  assert.equal(resolveModalHandler([later, open], 'esc')?.(), 'later');
});

test('the array order does not decide which dialog answers', () => {
  const first = entry(2, { esc: () => 'first' });
  const second = entry(5, { esc: () => 'second' });
  assert.equal(resolveModalHandler([first, second], 'esc')?.(), 'second');
  assert.equal(resolveModalHandler([second, first], 'esc')?.(), 'second');
});

test('a dialog without the handler falls through to the one below', () => {
  const parent = entry(1, { esc: () => 'parent', enter: () => 'parent-enter' });
  const child = entry(2, { esc: () => 'child' });
  assert.equal(resolveModalHandler([child, parent], 'esc')?.(), 'child');
  assert.equal(resolveModalHandler([child, parent], 'enter')?.(), 'parent-enter');
});

test('no dialog means no handler', () => {
  assert.equal(resolveModalHandler([], 'esc'), undefined);
  assert.equal(resolveModalHandler([entry(1, {})], 'enter'), undefined);
});

test('Enter is left to a select, a button or a textarea', () => {
  assert.equal(enterTargetHandlesItself({ closest: (selector) => (selector.includes('select') ? {} : null) }), true);
  assert.equal(enterTargetHandlesItself({ closest: (selector) => (selector.includes('button') ? {} : null) }), true);
  assert.equal(enterTargetHandlesItself({ closest: (selector) => (selector.includes('textarea') ? {} : null) }), true);
  assert.equal(enterTargetHandlesItself({ closest: () => null }), false);
  assert.equal(enterTargetHandlesItself(null), false);
});
