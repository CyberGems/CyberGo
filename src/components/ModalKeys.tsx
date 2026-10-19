import { useEffect, useRef } from 'react';

export type ModalKeys = { esc?: () => void; enter?: () => void };

export interface ModalEntry {
  order: number;
  keys: ModalKeys;
}

/**
 * The topmost modal is the one with the highest order, never the one that
 * happens to sit last in the array. React flushes effects from the deepest
 * child upwards, so a date picker nested in the item dialog registers before
 * its parent and the parent used to win the key.
 */
export function resolveModalHandler(entries: ModalEntry[], kind: 'esc' | 'enter'): (() => void) | undefined {
  let best: ModalEntry | null = null;
  for (const entry of entries) {
    if (!entry.keys[kind]) continue;
    if (!best || entry.order > best.order) best = entry;
  }
  return best ? best.keys[kind] : undefined;
}

/** A select opens its own list on Enter and a button runs its own action. */
export function enterTargetHandlesItself(target: { closest: (selector: string) => unknown } | null): boolean {
  if (!target) return false;
  return Boolean(target.closest('textarea, select, button'));
}

type Entry = { ref: { current: ModalKeys }; order: number };

const stack: Entry[] = [];

/**
 * Monotonic counter used to order the modal stack. The number is taken while
 * rendering, not while the effect runs, so a nested dialog always ends up
 * above the dialog that contains it.
 */
let sequence = 0;

function onKey(e: KeyboardEvent) {
  const entries: ModalEntry[] = stack.map((entry) => ({ order: entry.order, keys: entry.ref.current }));
  if (e.key === 'Escape') {
    const esc = resolveModalHandler(entries, 'esc');
    if (!esc) return;
    e.preventDefault();
    esc();
    return;
  }
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  if (enterTargetHandlesItself(e.target as HTMLElement | null)) return;
  const enter = resolveModalHandler(entries, 'enter');
  if (!enter) return;
  e.preventDefault();
  enter();
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

export function useModalKeys(enabled: boolean, keys: ModalKeys) {
  const ref = useRef(keys);
  ref.current = keys;
  const order = useRef(0);
  const wasEnabled = useRef(false);
  if (enabled && !wasEnabled.current) order.current = ++sequence;
  wasEnabled.current = enabled;
  useEffect(() => {
    if (!enabled) return;
    const entry: Entry = { ref, order: order.current };
    stack.push(entry);
    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [enabled]);
}

export function EscHint() {
  return <kbd className="key-hint">Esc</kbd>;
}

export function EnterGlyph() {
  return (
    <svg className="key-enter" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.6 8.2 L5.6 4.2 L4.1 7.1 L11.4 7.1 L11.4 2.2 L13.6 2.2 L13.6 7.1 A2.2 2.2 0 0 1 11.4 9.3 L4.1 9.3 L5.6 12.2 Z" fill="currentColor" />
    </svg>
  );
}
