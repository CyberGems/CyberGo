import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lang } from '@shared/types';
import { parseLocal } from '@shared/schedule';
import type { Copy } from '../i18n';
import { formatClock, formatDate } from '../lib/format';
import { useModalKeys } from './ModalKeys';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function stamp(date: Date, allDay: boolean) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (allDay) return day;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function read(value: string, allDay: boolean): Date {
  if (!value) return new Date();
  try {
    return parseLocal(value, allDay);
  } catch {
    return new Date();
  }
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthCells(year: number, month: number, weekStart: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function weekdayLabels(lang: Lang, weekStart: number) {
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(2026, 0, 4 + weekStart + i);
    return day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 2);
  });
}

export default function DateTimeField({
  value,
  allDay,
  lang,
  copy,
  onChange,
}: {
  value: string;
  allDay: boolean;
  lang: Lang;
  copy: Copy;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });
  const selected = value ? read(value, allDay) : null;
  const [cursor, setCursor] = useState(() => selected ?? new Date());
  const weekStart = lang === 'es' ? 1 : 0;
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  /** Closing the popover hands the focus back to the button that opened it. */
  function closePicker() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useModalKeys(open, { esc: closePicker });

  useEffect(() => {
    if (!open) return;
    function down(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return;
      closePicker();
    }
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = allDay ? 292 : 456;
    const height = 332;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setBox((prev) => (prev.top === top && prev.left === left ? prev : { top, left }));
  }, [open, allDay]);

  useLayoutEffect(() => {
    if (!open) return;
    popRef.current?.querySelectorAll('.time-col .on').forEach((node) => {
      const el = node as HTMLElement;
      const parent = el.parentElement;
      if (!parent) return;
      parent.scrollTop = el.offsetTop - parent.clientHeight / 2 + el.clientHeight / 2;
    });
  }, [open, value]);

  function choose(next: Date) {
    const base = selected ?? new Date();
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(stamp(next, allDay));
    setCursor(next);
  }

  function chooseTime(hours: number, minutes: number) {
    const base = selected ?? new Date();
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
    onChange(stamp(next, false));
    setCursor(next);
  }

  const shown = selected ?? new Date();
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  if (selected && !minutes.includes(selected.getMinutes())) minutes.push(selected.getMinutes());
  minutes.sort((a, b) => a - b);
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth(), weekStart);
  const today = new Date();
  const label = !selected
    ? copy.pickDate
    : allDay
      ? formatDate(selected.toISOString(), lang)
      : `${formatDate(selected.toISOString(), lang)}, ${formatClock(selected.toISOString(), lang)}`;

  const popover = (
    <div
      ref={popRef}
      className={`picker-pop ${allDay ? 'date-only' : ''}`}
      data-dialog-overlay="picker"
      style={{ top: box.top, left: box.left }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="picker-cal">
        <div className="picker-head">
          <strong>{cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong>
          <span>
            <button type="button" aria-label={copy.previousMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
            <button type="button" aria-label={copy.nextMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
          </span>
        </div>
        <div className="picker-week">
          {weekdayLabels(lang, weekStart).map((name, index) => <span key={index}>{name}</span>)}
        </div>
        <div className="picker-grid">
          {cells.map((day) => {
            const outside = day.getMonth() !== cursor.getMonth();
            const on = selected ? sameDay(day, selected) : false;
            const isToday = sameDay(day, today);
            return (
              <button
                type="button"
                key={day.toISOString()}
                aria-label={day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                className={`${outside ? 'outside' : ''} ${on ? 'on' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => choose(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      {!allDay && (
        <div className="picker-time">
          <div className="time-col">
            {Array.from({ length: 24 }, (_, hour) => (
              <button type="button" key={hour} aria-label={copy.hourSlot.replace('{hour}', pad(hour))} className={shown.getHours() === hour && selected ? 'on' : ''} onClick={() => chooseTime(hour, shown.getMinutes())}>
                {pad(hour)}
              </button>
            ))}
          </div>
          <div className="time-col">
            {minutes.map((minute) => (
              <button type="button" key={minute} aria-label={copy.minuteSlot.replace('{minute}', pad(minute))} className={shown.getMinutes() === minute && selected ? 'on' : ''} onClick={() => chooseTime(shown.getHours(), minute)}>
                {pad(minute)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="picker-foot">
        <button type="button" onClick={() => { onChange(''); closePicker(); }}>{copy.pickerClear}</button>
        <button type="button" onClick={() => { onChange(stamp(new Date(), allDay)); setCursor(new Date()); }}>{copy.pickerToday}</button>
      </div>
    </div>
  );

  return (
    <div className="picker">
      <button
        type="button"
        ref={buttonRef}
        className={`picker-btn ${selected ? '' : 'placeholder'}`}
        aria-label={label}
        onClick={() => {
          setCursor(selected ?? new Date());
          setOpen((prev) => !prev);
        }}
      >
        <span>{label}</span>
        <Calendar size={14} />
      </button>
      {open && createPortal(popover, document.body)}
    </div>
  );
}
