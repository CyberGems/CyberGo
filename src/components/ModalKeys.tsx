import { useEffect, useRef } from 'react';

type Keys = { esc?: () => void; enter?: () => void };
const stack: { current: Keys }[] = [];

function onKey(e: KeyboardEvent) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    if (!top.current.esc) return;
    e.preventDefault();
    top.current.esc();
    return;
  }
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
  if (!top.current.enter) return;
  e.preventDefault();
  top.current.enter();
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

export function useModalKeys(enabled: boolean, keys: Keys) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    if (!enabled) return;
    stack.push(ref);
    return () => {
      const index = stack.indexOf(ref);
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
