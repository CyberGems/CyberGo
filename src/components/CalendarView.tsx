import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Group, Item, Lang } from '@shared/types';
import type { Copy } from '../i18n';
import { formatClock } from '../lib/format';
import Tooltip from './Tooltip';

const CHIPS_PER_CELL = 4;
/** The smallest a day of the month is drawn, so the number of the day always fits. */
const MIN_ROW_HEIGHT = 52;
/** The padding of the cell, the number of the day and the space after it. */
const CELL_CHROME = 32;
const CHIP_HEIGHT = 19;
const CHIP_GAP = 3;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function whenOf(item: Item): Date | null {
  const iso = item.occurrenceAt || item.startAt;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthCells(year: number, month: number, weekStart: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function weekdayLabels(lang: Lang, weekStart: number): string[] {
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(2026, 0, 4 + weekStart + i);
    return day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
  });
}

/** The first letter is raised, so "octubre de 2026" reads correctly. */
function capitalize(value: string, locale: string): string {
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

export default function CalendarView({
  copy,
  lang,
  items,
  groups,
  selectedIds,
  onSelect,
  onOpen,
  onNewDay,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  groups: Group[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onOpen: (item: Item) => void;
  onNewDay: (day: Date) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  /**
   * The day that is open in detail.
   *
   * The month has room for a few items per day, so the days with more open
   * the day view instead of hiding the rest behind a counter.
   */
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const weekStart = lang === 'es' ? 1 : 0;
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const gridRef = useRef<HTMLDivElement>(null);
  /**
   * The cell that is in the tab order.
   *
   * The grid has forty-two cells, and making all of them reachable would
   * put forty-two stops between the toolbar and the list. Only one of them
   * is in the tab order, and the arrow keys move the focus from there.
   */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  /**
   * The height of a day of the month.
   *
   * The window can be short, and a day only has room for the items that fit
   * in it. The rest are counted in the day, which opens them one by one.
   */
  const [rowHeight, setRowHeight] = useState(0);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const when = whenOf(item);
      if (!when) continue;
      const key = dayKey(when);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (whenOf(a)?.getTime() ?? 0) - (whenOf(b)?.getTime() ?? 0));
    }
    return map;
  }, [items]);

  const undated = useMemo(() => items.filter((item) => !whenOf(item)), [items]);
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth(), weekStart);
  const todayIndex = cells.findIndex((day) => sameDay(day, today));
  const tabbableIndex = focusIndex ?? (todayIndex >= 0 ? todayIndex : 0);
  const monthTotal = useMemo(() => {
    let total = 0;
    for (const list of byDay.values()) {
      for (const item of list) {
        const when = whenOf(item);
        if (when && when.getMonth() === cursor.getMonth() && when.getFullYear() === cursor.getFullYear()) total += 1;
      }
    }
    return total;
  }, [byDay, cursor]);

  // Another month starts with its own cell in the tab order.
  useEffect(() => { setFocusIndex(null); }, [cursor]);

  // The height of the grid tells how much room a day has for its items.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => setRowHeight(Math.max(MIN_ROW_HEIGHT, (grid.clientHeight - 5) / 6));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [openDay]);

  /**
   * How many items of a day are drawn.
   *
   * The counter of the rest sits next to the number of the day, so it never
   * competes with the items for the room of the cell.
   */
  function limitFor(total: number): number {
    if (rowHeight <= 0) return Math.min(CHIPS_PER_CELL, total);
    const room = rowHeight - CELL_CHROME;
    // A pixel of slack, because the days that carry items are a little taller
    // than the empty ones.
    const fits = Math.floor((room + CHIP_GAP + 1) / (CHIP_HEIGHT + CHIP_GAP));
    return Math.max(0, Math.min(CHIPS_PER_CELL, fits, total));
  }

  function focusCell(index: number) {
    const target = gridRef.current?.querySelectorAll<HTMLDivElement>('.cal-cell')[index];
    if (!target) return;
    setFocusIndex(index);
    target.focus();
  }

  function goMonth(offset: number) {
    setOpenDay(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
  }

  function goToday() {
    setOpenDay(null);
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  /**
   * Opens a day in detail.
   *
   * A day of the month next to the one that is shown belongs to another
   * month, and that month is the one that is shown when the day is closed.
   */
  function openDayDetail(day: Date) {
    if (day.getMonth() !== cursor.getMonth() || day.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
    }
    setOpenDay(day);
  }

  // Only the first letter is raised, so "octubre de 2026" reads correctly.
  const monthTitle = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const monthLabel = capitalize(monthTitle, locale);
  const dayTitle = openDay
    ? capitalize(openDay.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }), locale)
    : '';
  const dayItems = openDay ? byDay.get(dayKey(openDay)) ?? [] : [];

  function tintOf(item: Item): string {
    const group = groups.find((g) => g.id === item.groupId);
    return item.color || group?.color || 'var(--accent)';
  }

  function chipStyle(item: Item): CSSProperties {
    const tint = tintOf(item);
    return {
      '--cal-tint': tint,
      '--cal-tint-soft': `color-mix(in srgb, ${tint} 15%, transparent)`,
    } as CSSProperties;
  }

  function chipLabel(item: Item): string {
    const kind = item.kind === 'task' ? copy.task : copy.event;
    const when = whenOf(item);
    const time = when && !item.allDay ? formatClock(when.toISOString(), lang) : '';
    return [time, item.title, kind].filter(Boolean).join(', ');
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-head-copy">
          <p className="cal-kicker">{openDay ? copy.calDayKicker : copy.viewCalendar}</p>
          <h2 className="cal-title">{openDay ? dayTitle : monthLabel}</h2>
        </div>
        <div className="cal-head-actions">
          {openDay ? (
            <button type="button" className="btn" onClick={() => setOpenDay(null)}>
              <ChevronLeft size={14} />
              {copy.calMonth}
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={goToday}>{copy.pickerToday}</button>
              <Tooltip label={copy.previousMonth} placement="top">
                <button type="button" className="icon-btn" aria-label={copy.previousMonth} onClick={() => goMonth(-1)}><ChevronLeft size={16} /></button>
              </Tooltip>
              <Tooltip label={copy.nextMonth} placement="top">
                <button type="button" className="icon-btn" aria-label={copy.nextMonth} onClick={() => goMonth(1)}><ChevronRight size={16} /></button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {openDay ? (
        <div className="cal-day">
          {dayItems.length === 0 ? (
            <div className="cal-day-empty">
              <CalendarDays size={22} />
              <p>{copy.calEmptyDay}</p>
              <button type="button" className="btn btn-primary" onClick={() => onNewDay(openDay)}>
                <Plus size={14} />
                {copy.calAddOnDay}
              </button>
            </div>
          ) : (
            <ul className="cal-day-list">
              {dayItems.map((item) => {
                const when = whenOf(item);
                const group = groups.find((g) => g.id === item.groupId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`cal-day-row ${selectedIds.includes(item.id) ? 'selected' : ''} ${item.completedAt ? 'done' : ''}`}
                      style={chipStyle(item)}
                      onClick={() => onSelect([item.id])}
                      onDoubleClick={() => onOpen(item)}
                      aria-label={chipLabel(item)}
                    >
                      <span className="cal-day-time">
                        {when && !item.allDay ? formatClock(when.toISOString(), lang) : copy.allDay}
                      </span>
                      <span className="cal-day-main">
                        <span className="cal-day-title-text">{item.title}</span>
                        <span className="cal-day-meta">
                          {item.kind === 'task' ? copy.task : copy.event}
                          {group ? ` · ${group.name}` : ''}
                        </span>
                      </span>
                      <span className="cal-day-tag" style={{ background: tintOf(item) }} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" className="cal-day-add" onClick={() => onNewDay(openDay)}>
                  <Plus size={14} />
                  {copy.calAddOnDay}
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="cal-dow" aria-hidden="true">
            {weekdayLabels(lang, weekStart).map((name, index) => (
              <span key={index} className={index >= 5 ? 'weekend' : ''}>{name}</span>
            ))}
          </div>
          <div className="cal-grid" ref={gridRef}>
            {cells.map((day, index) => {
              const outside = day.getMonth() !== cursor.getMonth();
              const isToday = sameDay(day, today);
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              const list = byDay.get(dayKey(day)) ?? [];
              const limit = limitFor(list.length);
              const shown = list.slice(0, limit);
              const hidden = list.length - shown.length;
              return (
                <div
                  key={day.toISOString()}
                  className={`cal-cell ${outside ? 'outside' : ''} ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''}`}
                  onDoubleClick={() => onNewDay(day)}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onNewDay(day);
                      return;
                    }
                    const step = event.key === 'ArrowLeft' ? -1
                      : event.key === 'ArrowRight' ? 1
                        : event.key === 'ArrowUp' ? -7
                          : event.key === 'ArrowDown' ? 7 : 0;
                    if (!step) return;
                    const next = index + step;
                    if (next < 0 || next >= cells.length) return;
                    event.preventDefault();
                    focusCell(next);
                  }}
                  tabIndex={index === tabbableIndex ? 0 : -1}
                  aria-label={`${day.toLocaleDateString(locale, { dateStyle: 'full' })}. ${copy.calNewHint}`}
                >
                  <span className="cal-daynum">
                    <button
                      type="button"
                      className="cal-daynum-value"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); openDayDetail(day); }}
                      onDoubleClick={(e) => { e.stopPropagation(); }}
                      aria-label={`${day.toLocaleDateString(locale, { dateStyle: 'full' })}. ${copy.calOpenDay}`}
                    >
                      {day.getDate()}
                    </button>
                    {hidden > 0 && (
                      <button
                        type="button"
                        className="cal-more"
                        onClick={(e) => { e.stopPropagation(); openDayDetail(day); }}
                        aria-label={copy.calShowMore.replace('{n}', String(hidden))}
                      >
                        +{hidden} {copy.calMore}
                      </button>
                    )}
                  </span>
                  {shown.map((item) => {
                    const when = whenOf(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`cal-chip ${selectedIds.includes(item.id) ? 'selected' : ''} ${item.completedAt ? 'done' : ''} kind-${item.kind}`}
                        style={chipStyle(item)}
                        onClick={(e) => { e.stopPropagation(); onSelect([item.id]); }}
                        onDoubleClick={(e) => { e.stopPropagation(); onOpen(item); }}
                        aria-label={chipLabel(item)}
                      >
                        {when && !item.allDay && <span className="cal-chip-time">{formatClock(when.toISOString(), lang)}</span>}
                        <span className="cal-chip-title">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="cal-foot">
            <span className="cal-foot-count">
              {monthTotal} {copy.cmdItems.toLocaleLowerCase(locale)}
            </span>
            {undated.length > 0 && (
              <div className="cal-undated">
                <span className="cal-undated-label">{copy.quickNone}</span>
                {undated.slice(0, 12).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${selectedIds.includes(item.id) ? 'on' : ''}`}
                    onClick={() => onSelect([item.id])}
                    onDoubleClick={() => onOpen(item)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
