import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Flag } from 'lucide-react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Copy } from '../i18n';
import type { Group, Item, Lang } from '@shared/types';
import { formatDate, formatTimeRange, itemStatus } from '../lib/format';
import type { SortColumn, SortDirection } from '../lib/view';
import Tooltip from './Tooltip';
import { useListSelection } from '../hooks/useListSelection';

/**
 * The columns of the list: the marker, the date, the time, the state, the
 * subject and the kind.
 *
 * The subject is the flexible one: it takes the room that is left, so the
 * name is never cut and the table always fits the space it has.
 */
const SUBJECT_COLUMN = 4;
const MARKER_COLUMN = 0;
const TABLE_WIDTHS = [12, 96, 80, 96, 200, 48];
const TABLE_MIN_WIDTHS = [10, 76, 68, 84, 180, 44];
const TABLE_MAX_WIDTHS = [40, 200, 180, 260, 900, 120];
/**
 * The last column holds the kind of the item, and its width is fixed.
 *
 * The right edge of the last column is the right edge of the table, and
 * that edge never moves: the subject takes the room that is left. A handle
 * there would be dragged without anything moving, so there is none.
 */
const LAST_COLUMN = TABLE_WIDTHS.length - 1;
const LAST_COLUMN_WIDTH = 60;
const TABLE_WIDTH_STORAGE = 'cybergo-table-column-widths-v1';

function initialTableWidths(): number[] {
  if (typeof window === 'undefined') return [...TABLE_WIDTHS];
  try {
    const saved = JSON.parse(window.localStorage.getItem(TABLE_WIDTH_STORAGE) || 'null');
    if (!Array.isArray(saved) || saved.length !== TABLE_WIDTHS.length) return [...TABLE_WIDTHS];
    return saved.map((value: unknown, index: number) => {
      const width = Number(value);
      return Number.isFinite(width)
        ? Math.min(TABLE_MAX_WIDTHS[index], Math.max(TABLE_MIN_WIDTHS[index], Math.round(width)))
        : TABLE_WIDTHS[index];
    });
  } catch {
    return [...TABLE_WIDTHS];
  }
}

function safeTint(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '';
}

export default function ItemTable({
  copy,
  lang,
  items,
  groups,
  selectedIds,
  onSelect,
  onOpen,
  onDelete,
  onContextMenu,
  sort,
  onSort,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  groups: Group[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onOpen: (item: Item) => void;
  onDelete?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>, id: string) => void;
  sort: { column: SortColumn; direction: SortDirection } | null;
  onSort: (column: SortColumn) => void;
}) {
  const [widths, setWidths] = useState(initialTableWidths);
  const widthsRef = useRef(widths);
  const stopResizeRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selection = useListSelection({
    listRef,
    rows: items,
    selected: selectedIds,
    onChange: onSelect,
    onActivate: onOpen,
    onDelete,
  });

  const applyWidths = useCallback((next: number[]) => {
    widthsRef.current = next;
    setWidths(next);
  }, []);

  // Column widths are written once per finished resize, not on every pointer
  // move, so dragging a column does not hammer localStorage.
  const persistWidths = useCallback((next: number[]) => {
    try {
      window.localStorage.setItem(TABLE_WIDTH_STORAGE, JSON.stringify(next));
    } catch {
      /* Storage can be unavailable, the widths just will not persist. */
    }
  }, []);

  useEffect(() => () => {
    stopResizeRef.current?.();
  }, []);

  if (!items.length) return null;

  const tableStyle = {
    '--table-columns': widths
      .map((width, index) => {
        // The subject takes the room that is left, and it can give all of it
        // away, so the table never grows past the window.
        if (index === SUBJECT_COLUMN) return 'minmax(0px, 1fr)';
        if (index === LAST_COLUMN) return `${LAST_COLUMN_WIDTH}px`;
        return `${width}px`;
      })
      .join(' '),
    // The smallest the table can be. It is made of the smallest width of
    // every column, so widening one of them does not push the table out.
    '--table-width': `${TABLE_MIN_WIDTHS.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 8 + 28}px`,
  } as CSSProperties;

  function resizeColumn(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = widthsRef.current[index];
    document.body.classList.add('is-resizing-column');
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const nextWidth = Math.min(
        TABLE_MAX_WIDTHS[index],
        Math.max(TABLE_MIN_WIDTHS[index], Math.round(startWidth + moveEvent.clientX - startX)),
      );
      applyWidths(widthsRef.current.map((width, currentIndex) => currentIndex === index ? nextWidth : width));
    };
    const stop = () => {
      document.body.classList.remove('is-resizing-column');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      try {
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        /* The capture may already be gone, nothing else to clean up. */
      }
      stopResizeRef.current = null;
      persistWidths(widthsRef.current);
    };
    stopResizeRef.current = stop;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* Capture is an optimisation, the window listeners still work. */
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
  }

  function setColumnWidth(index: number, width: number) {
    const next = widthsRef.current.map((current, currentIndex) => (
      currentIndex === index
        ? Math.min(TABLE_MAX_WIDTHS[index], Math.max(TABLE_MIN_WIDTHS[index], width))
        : current
    ));
    applyWidths(next);
    persistWidths(next);
  }

  const headers: { key: SortColumn | null; label: string }[] = [
    { key: null, label: '' },
    { key: 'date', label: copy.colWhen },
    { key: 'time', label: copy.colTime },
    { key: 'state', label: copy.colLeft },
    { key: 'subject', label: copy.colSubject },
    { key: 'kind', label: copy.kind },
  ];
  return (
    <>
      <div
        className="table-scroll"
        ref={listRef}
        onMouseDown={(event) => {
          // Dragging the edge of a column is not a selection.
          if ((event.target as HTMLElement).closest('.column-resizer')) return;
          selection.onPointerDown(event);
        }}
        onClick={(event) => {
          // The click that ends a drag is not a click on the room of the list.
          if (selection.consumeClick()) return;
          // A click on the empty room of the list takes the selection away.
          const target = event.target as HTMLElement;
          if (target.closest('[data-id]')) return;
          if (target.classList.contains('table-scroll') || target.classList.contains('rows')) {
            onSelect([]);
          }
        }}
      >
        <div className="list-head" style={tableStyle}>
          {headers.map((column, index) => {
            const label = column.label;
            const sorted = sort?.column === column.key;
            const direction = sorted ? sort.direction : null;
            return (
              <span
                className={`table-head-cell ${index === LAST_COLUMN ? 'last' : ''}`}
                key={column.key || 'marker'}
                aria-sort={column.key ? (sorted ? (direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
              >
                {column.key && (
                  <button
                    type="button"
                    className={`column-sort ${sorted ? 'sorted' : ''}`}
                    onClick={() => onSort(column.key as SortColumn)}
                    aria-label={sorted
                      ? `${copy.sortBy.replace('{column}', label)} · ${direction === 'asc' ? copy.sortAsc : copy.sortDesc}`
                      : copy.sortBy.replace('{column}', label)}
                  >
                    <span>{label}</span>
                    <span className="column-sort-arrow" data-hidden={!sorted} aria-hidden="true">
                      {direction === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                    </span>
                  </button>
                )}
                {index !== SUBJECT_COLUMN && index !== LAST_COLUMN && index !== MARKER_COLUMN && (
                  <Tooltip label={`${copy.resizeColumn}: ${label}`} placement="top" delay={350}>
                    <button
                      type="button"
                      className="column-resizer"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`${copy.resizeColumn}: ${label}`}
                      aria-valuemin={TABLE_MIN_WIDTHS[index]}
                      aria-valuemax={TABLE_MAX_WIDTHS[index]}
                      aria-valuenow={widths[index]}
                      onPointerDown={(event) => resizeColumn(index, event)}
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                        event.preventDefault();
                        const delta = event.key === 'ArrowRight' ? 12 : -12;
                        setColumnWidth(index, widthsRef.current[index] + delta);
                      }}
                      onDoubleClick={() => setColumnWidth(index, TABLE_WIDTHS[index])}
                    />
                  </Tooltip>
                )}
              </span>
            );
          })}
        </div>
        <div className="rows" style={tableStyle}>
          {items.map((item) => {
            const group = groups.find((g) => g.id === item.groupId);
            const tint = safeTint(item.color || group?.color || '');
            const status = itemStatus(item, copy, true);
            const fullStatus = itemStatus(item, copy).label;
            // The empty parts are left out, so the label does not read
            // "Buy milk, , ,".
            const label = [
              item.title,
              item.notes,
              formatDate(item.occurrenceAt || item.startAt, lang),
              formatTimeRange(item, lang, copy),
              status.label,
            ].filter(Boolean).join(', ');
            return (
              <div
                key={item.id}
                data-id={item.id}
                className={`row ${selectedIds.includes(item.id) ? 'selected' : ''} ${selection.hits.includes(item.id) ? 'in-drag' : ''}`}
                onClick={(event) => {
                  if (selection.consumeClick()) return;
                  selection.select(item.id, event.ctrlKey || event.metaKey, event.shiftKey);
                }}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(event) => onContextMenu?.(event, item.id)}
                role="button"
                tabIndex={0}
                aria-current={selectedIds.includes(item.id) ? 'true' : undefined}
                aria-label={label}
                style={tint && !selectedIds.includes(item.id) && !selection.hits.includes(item.id) ? { background: `color-mix(in srgb, ${tint} 12%, transparent)` } : undefined}
              >
                <i className="dot" style={{ background: tint || 'transparent', border: tint ? 'none' : '1px solid var(--border)' }} />
                <span className="date-cell">
                  <span className="date-value">{formatDate(item.occurrenceAt || item.startAt, lang) || copy.quickNone}</span>
                </span>
                <span className="time-cell">
                  {/* The date column already says that there is no date, so
                      the time column stays empty instead of repeating it. */}
                  <span>{formatTimeRange(item, lang, copy)}</span>
                </span>
                <span className="row-status">
                  {status.label && (
                    <span className={`status-pill ${status.tone}`} title={fullStatus || undefined}>
                      {status.label}
                    </span>
                  )}
                </span>
                <span className="subject" title={item.notes || undefined}>{item.importance === 'high' && <Flag className="flag" size={12} style={{ marginRight: 6 }} />}{item.title}</span>
                <span className={`kind-tag kind-${item.kind}`}>{item.kind === 'task' ? copy.task : copy.event}</span>
              </div>
            );
          })}
        </div>
        {selection.marquee && (
          <div
            className="drag-marquee"
            aria-hidden="true"
            style={{
              left: selection.marquee.left,
              top: selection.marquee.top,
              width: selection.marquee.width,
              height: selection.marquee.height,
            }}
          />
        )}
      </div>
    </>
  );
}
