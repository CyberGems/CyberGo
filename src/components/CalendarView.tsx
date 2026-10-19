import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Group, Item, Lang } from '@shared/types';
import type { Copy } from '../i18n';
import Tooltip from './Tooltip';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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

export default function CalendarView({
  copy,
  lang,
  items,
  groups,
  selectedId,
  onSelect,
  onOpen,
  onNewDay,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (item: Item) => void;
  onNewDay: (day: Date) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const weekStart = lang === 'es' ? 1 : 0;
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

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

  return (
    <div className="cal">
      <div className="cal-head">
        <strong>{cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong>
        <span>
          <button type="button" className="btn" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>{copy.pickerToday}</button>
          <Tooltip label={copy.previousMonth} placement="top">
            <button type="button" className="icon-btn" aria-label={copy.previousMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
          </Tooltip>
          <Tooltip label={copy.nextMonth} placement="top">
            <button type="button" className="icon-btn" aria-label={copy.nextMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
          </Tooltip>
        </span>
      </div>
      <div className="cal-dow">
        {weekdayLabels(lang, weekStart).map((name, index) => <span key={index}>{name}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((day) => {
          const outside = day.getMonth() !== cursor.getMonth();
          const isToday = day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth() && day.getDate() === today.getDate();
          const list = byDay.get(dayKey(day)) ?? [];
          const shown = list.slice(0, 3);
          return (
            <div
              key={day.toISOString()}
              className={`cal-cell ${outside ? 'outside' : ''} ${isToday ? 'today' : ''}`}
              onDoubleClick={() => onNewDay(day)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNewDay(day);
                }
              }}
              tabIndex={0}
              aria-label={`${day.toLocaleDateString(locale, { dateStyle: 'full' })}. ${copy.calNewHint}`}
            >
            <span className="cal-daynum"><span>{day.getDate()}</span>{isToday && <span className="cal-today-label">{copy.todayWord}</span>}</span>
            {shown.map((item) => {
              const group = groups.find((g) => g.id === item.groupId);
              const tint = item.color || group?.color || 'var(--accent)';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cal-chip ${selectedId === item.id ? 'selected' : ''} ${item.completedAt ? 'done' : ''} kind-${item.kind}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); onOpen(item); }}
                  aria-label={`${item.title}, ${item.kind === 'task' ? copy.task : copy.event}`}
                >
                  <i className="dot" style={{ background: tint }} />
                  <span className="subject">{item.title}</span>
                </button>
              );
            })}
            {list.length > shown.length && (
              <span className="cal-more">+{list.length - shown.length} {copy.calMore}</span>
            )}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className="cal-undated">
          <span className="hint">{copy.cmdItems} · {copy.quickNone}:</span>
          {undated.slice(0, 12).map((item) => (
            <button key={item.id} type="button" className={`chip ${selectedId === item.id ? 'on' : ''}`} onClick={() => onSelect(item.id)} onDoubleClick={() => onOpen(item)}>
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
