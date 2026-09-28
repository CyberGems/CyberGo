import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Copy } from '../i18n';
import type { Group, Item, Lang } from '@shared/types';
import { dayDiff, daysLeft, dueState, formatDate, formatTimeRange } from '../lib/format';
import Tooltip from './Tooltip';

const TABLE_WIDTHS = [14, 132, 126, 180, 340, 76];
const TABLE_MIN_WIDTHS = [10, 80, 80, 110, 160, 56];
const TABLE_MAX_WIDTHS = [64, 320, 320, 360, 900, 180];
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
  useEffect(() => {
    window.localStorage.setItem(TABLE_WIDTH_STORAGE, JSON.stringify(widths));
  }, [widths]);
  if (!items.length) return null;

  const tableStyle = {
    '--table-columns': widths.map((width) => `${width}px`).join(' '),
    '--table-width': `${widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 8 + 28}px`,
  } as CSSProperties;

  function resizeColumn(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[index];
    document.body.classList.add('is-resizing-column');
    const move = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        TABLE_MAX_WIDTHS[index],
        Math.max(TABLE_MIN_WIDTHS[index], Math.round(startWidth + moveEvent.clientX - startX)),
      );
      setWidths((current) => current.map((width, currentIndex) => currentIndex === index ? nextWidth : width));
    };
    const stop = () => {
      document.body.classList.remove('is-resizing-column');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  const headers = [null, copy.colWhen, copy.colTime, copy.colLeft, copy.colSubject, copy.kind];
  return (
    <>
      <div className="table-scroll">
        <div className="list-head" style={tableStyle}>
          {headers.map((label, index) => (
            <span className="table-head-cell" key={label || 'marker'}>
              {label}
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
                    setWidths((current) => current.map((width, currentIndex) => currentIndex === index
                      ? Math.min(TABLE_MAX_WIDTHS[index], Math.max(TABLE_MIN_WIDTHS[index], width + delta))
                      : width));
                  }}
                  onDoubleClick={() => setWidths((current) => current.map((width, currentIndex) => currentIndex === index ? TABLE_WIDTHS[index] : width))}
                />
              </Tooltip>
            </span>
          ))}
        </div>
        <div className="rows" style={tableStyle}>
          {items.map((item) => {
            const group = groups.find((g) => g.id === item.groupId);
            const tint = safeTint(item.color || group?.color || '');
            const diff = dayDiff(item.occurrenceAt || item.startAt);
            const relative = daysLeft(item, copy, lang);
            const statusClass = dueState(item.occurrenceAt || item.startAt) ?? (diff == null ? '' : diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'future');
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
                aria-pressed={selectedId === item.id}
                aria-label={`${item.title}, ${formatDate(item.occurrenceAt || item.startAt, lang)}, ${formatTimeRange(item, lang, copy)}, ${relative}`}
                style={tint && selectedId !== item.id ? { background: `color-mix(in srgb, ${tint} 12%, transparent)` } : undefined}
              >
                <i className="dot" style={{ background: tint || 'transparent', border: tint ? 'none' : '1px solid var(--border)' }} />
                <span className="date-cell">
                  <span className="date-value">{formatDate(item.occurrenceAt || item.startAt, lang) || copy.quickNone}</span>
                </span>
                <span className="time-cell">
                  <span>{formatTimeRange(item, lang, copy) || copy.quickNone}</span>
                </span>
                <span className="row-status">
                  {relative && (
                    <Tooltip label={relative} placement="top">
                      <span className={`status-pill ${statusClass}`} aria-label={relative}>{relative}</span>
                    </Tooltip>
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
