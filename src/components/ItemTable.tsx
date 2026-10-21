import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Copy } from '../i18n';
import type { Group, Item, Lang } from '@shared/types';
import { formatDate, formatTimeRange, itemStatus } from '../lib/format';
import Tooltip from './Tooltip';

/**
 * The columns of the list: the marker, the date, the time, the state, the
 * subject and the kind.
 *
 * The subject is the flexible one: it takes the room that is left, so the
 * name is never cut and the table always fits the space it has.
 */
const SUBJECT_COLUMN = 4;
const TABLE_WIDTHS = [12, 96, 80, 96, 200, 48];
const TABLE_MIN_WIDTHS = [10, 76, 68, 84, 180, 44];
const TABLE_MAX_WIDTHS = [40, 200, 180, 260, 900, 120];
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
  selectedId,
  onSelect,
  onOpen,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (item: Item) => void;
}) {
  const [widths, setWidths] = useState(initialTableWidths);
  const widthsRef = useRef(widths);
  const stopResizeRef = useRef<(() => void) | null>(null);

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
      .map((width, index) => (index === SUBJECT_COLUMN ? `minmax(${width}px, 1fr)` : `${width}px`))
      .join(' '),
    '--table-width': `${widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 8 + 28}px`,
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

  const headers = [null, copy.colWhen, copy.colTime, copy.colLeft, copy.colSubject, copy.kind];
  return (
    <>
      <div className="table-scroll">
        <div className="list-head" style={tableStyle}>
          {headers.map((label, index) => (
            <span className="table-head-cell" key={label || 'marker'}>
              {label}
              {index !== SUBJECT_COLUMN && (
                <Tooltip label={`${copy.resizeColumn}: ${label || copy.colMarker}`} placement="top" delay={350}>
                  <button
                    type="button"
                    className="column-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${copy.resizeColumn}: ${label || copy.colMarker}`}
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
          ))}
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
              formatDate(item.occurrenceAt || item.startAt, lang),
              formatTimeRange(item, lang, copy),
              status.label,
            ].filter(Boolean).join(', ');
            return (
              <div
                key={item.id}
                className={`row ${selectedId === item.id ? 'selected' : ''}`}
                onClick={() => onSelect(item.id)}
                onDoubleClick={() => onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onOpen(item);
                  if (event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-current={selectedId === item.id ? 'true' : undefined}
                aria-label={label}
                style={tint && selectedId !== item.id ? { background: `color-mix(in srgb, ${tint} 12%, transparent)` } : undefined}
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
                <span className="subject">{item.importance === 'high' && <Flag className="flag" size={12} style={{ marginRight: 6 }} />}{item.title}</span>
                <span className={`kind-tag kind-${item.kind}`}>{item.kind === 'task' ? copy.task : copy.event}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
