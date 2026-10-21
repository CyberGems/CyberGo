import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

/**
 * The rectangle of a drag that selects the rows it touches.
 *
 * The measures are the ones of the screen, so the rectangle is always drawn
 * under the pointer, no matter which list it belongs to.
 */
export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** What a drag is doing, kept outside the state so the move is cheap. */
interface DragState {
  startX: number;
  startY: number;
  moved: boolean;
  additive: boolean;
  base: string[];
}

/** How far the pointer has to travel before a click turns into a drag. */
const DRAG_THRESHOLD = 4;

export interface ListSelection {
  /** The rectangle being drawn, or null when there is no drag. */
  marquee: MarqueeRect | null;
  /** The ids of the rows the drag is about to select. */
  hits: string[];
  /** Starts a drag. Put it on the container of the rows. */
  onPointerDown: (event: ReactMouseEvent<HTMLElement>) => void;
  /** True when the click that ends a drag should be ignored. */
  consumeClick: () => boolean;
  /** Selects a single row, or a range when the shift is held. */
  select: (id: string, additive: boolean, range: boolean) => void;
}

/**
 * The selection of a list of rows.
 *
 * A row can be picked with the mouse, with the keyboard, or by dragging a
 * rectangle over the rows, the way a file explorer does.
 */
export function useListSelection<T extends { id: string }>({
  listRef,
  rows,
  selected,
  onChange,
  onActivate,
  onDelete,
  disabled = false,
}: {
  listRef: RefObject<HTMLElement | null>;
  rows: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onActivate?: (item: T) => void;
  onDelete?: () => void;
  disabled?: boolean;
}): ListSelection {
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [hits, setHits] = useState<string[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const hitsRef = useRef<string[]>([]);
  const skipClickRef = useRef(false);
  const anchorRef = useRef<string | null>(null);
  /** The place of the rows, measured once per drag. */
  const rowRectsRef = useRef<{ id: string; rect: DOMRect }[]>([]);
  /** The scroll of the list when the rows were measured. */
  const scrollRef = useRef(-1);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  /**
   * The rows a rectangle of the screen touches.
   *
   * The place of the rows is measured once per drag, and again when the list
   * is scrolled, so a long list does not pay for a measure on every move of
   * the pointer.
   */
  const rowsInRect = useCallback((rect: MarqueeRect): string[] => {
    const list = listRef.current;
    if (!list) return [];
    if (!rowRectsRef.current.length || scrollRef.current !== list.scrollTop) {
      scrollRef.current = list.scrollTop;
      rowRectsRef.current = Array.from(list.querySelectorAll<HTMLElement>('[data-id]')).flatMap((row) => {
        const id = row.getAttribute('data-id');
        return id ? [{ id, rect: row.getBoundingClientRect() }] : [];
      });
    }
    const found: string[] = [];
    for (const { id, rect: rowRect } of rowRectsRef.current) {
      const inside = rowRect.bottom > rect.top
        && rowRect.top < rect.top + rect.height
        && rowRect.right > rect.left
        && rowRect.left < rect.left + rect.width;
      if (inside) found.push(id);
    }
    return found;
  }, [listRef]);

  // The drag is followed on the document, because the pointer usually ends
  // outside the row it started on.
  useEffect(() => {
    function move(event: MouseEvent) {
      const drag = dragRef.current;
      const list = listRef.current;
      if (!drag || !list) return;
      if (!drag.moved) {
        const travelled = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (travelled < DRAG_THRESHOLD) return;
        drag.moved = true;
      }
      const rect: MarqueeRect = {
        left: Math.min(drag.startX, event.clientX),
        top: Math.min(drag.startY, event.clientY),
        width: Math.abs(event.clientX - drag.startX),
        height: Math.abs(event.clientY - drag.startY),
      };
      const found = rowsInRect(rect);
      hitsRef.current = found;
      setHits(found);
      setMarquee(rect);
    }

    function up() {
      const drag = dragRef.current;
      dragRef.current = null;
      rowRectsRef.current = [];
      scrollRef.current = -1;
      setMarquee(null);
      setHits([]);
      if (!drag || !drag.moved) return;
      // The click that ends the drag must not pick the row under the pointer.
      skipClickRef.current = true;
      const found = hitsRef.current;
      hitsRef.current = [];
      if (!drag.additive) {
        onChange(found);
        return;
      }
      const merged = new Set([...drag.base, ...found]);
      onChange([...merged]);
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [listRef, onChange, rowsInRect]);

  const select = useCallback((id: string, additive: boolean, range: boolean) => {
    const ids = rows.map((row) => row.id);
    if (range && anchorRef.current) {
      const from = ids.indexOf(anchorRef.current);
      const to = ids.indexOf(id);
      if (from >= 0 && to >= 0) {
        const [start, end] = from <= to ? [from, to] : [to, from];
        onChange(ids.slice(start, end + 1));
        return;
      }
    }
    anchorRef.current = id;
    if (additive) {
      const current = selectedRef.current;
      onChange(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
      return;
    }
    onChange([id]);
  }, [rows, onChange]);

  // The keyboard: the arrows move, the space marks, Ctrl+A takes everything.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (disabled) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const ids = rows.map((row) => row.id);
      if (!ids.length) return;
      const current = selectedRef.current;
      const index = current.length ? ids.indexOf(current[current.length - 1]) : -1;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const base = index < 0 ? (delta > 0 ? -1 : 0) : index;
        const next = ids[Math.max(0, Math.min(ids.length - 1, base + delta))];
        select(next, false, event.shiftKey);
        const node = listRef.current?.querySelector<HTMLElement>(`[data-id="${next}"]`);
        node?.focus();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        const focused = document.activeElement?.getAttribute('data-id');
        if (!focused) return;
        select(focused, true, false);
        return;
      }
      if (event.key === 'Enter') {
        const focused = document.activeElement?.getAttribute('data-id');
        const item = rows.find((row) => row.id === (focused ?? current[0]));
        if (!item || !onActivate) return;
        event.preventDefault();
        onActivate(item);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!current.length || !onDelete) return;
        event.preventDefault();
        onDelete();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        // Everything is selected already, so the selection is cleared.
        onChange(current.length === ids.length ? [] : ids);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, rows, select, onChange, onActivate, onDelete, listRef]);

  const onPointerDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    skipClickRef.current = false;
    // Every drag measures the rows again, because the list may have changed.
    rowRectsRef.current = [];
    scrollRef.current = -1;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      base: selectedRef.current,
    };
  }, []);

  const consumeClick = useCallback(() => {
    const skip = skipClickRef.current;
    skipClickRef.current = false;
    return skip;
  }, []);

  return { marquee, hits, onPointerDown, consumeClick, select };
}
