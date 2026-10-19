import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Item, Lang } from '@shared/types';
import type { Copy } from '../i18n';
import { formatDate } from '../lib/format';
import type { FilterId } from '../lib/view';
import DialogPanel from './Dialog';
import { useModalKeys } from './ModalKeys';

interface Row {
  key: string;
  label: string;
  hint: string;
  section: string;
  run: () => void;
}

const FILTERS: FilterId[] = ['all', 'today', 'next7', 'next30', 'upcoming', 'overdue', 'high', 'completed', 'trash'];

export default function CommandPalette({
  copy,
  lang,
  items,
  onClose,
  onOpenItem,
  onNew,
  onGoFilter,
  onShowReminders,
  onLock,
  onOpenSettings,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  onNew: (kind: 'event' | 'task') => void;
  onGoFilter: (filter: FilterId) => void;
  onShowReminders: () => void;
  onLock: () => void;
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The parent sends the callbacks as inline arrows, so their identity changes
  // on every render. They live in a ref to keep the row list stable.
  const handlers = useRef({ onClose, onOpenItem, onNew, onGoFilter, onShowReminders, onLock, onOpenSettings });
  handlers.current = { onClose, onOpenItem, onNew, onGoFilter, onShowReminders, onLock, onOpenSettings };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const labels = useMemo<Record<FilterId, string>>(() => ({
    all: copy.all,
    today: copy.today,
    next7: copy.next7,
    next30: copy.next30,
    upcoming: copy.upcoming,
    overdue: copy.overdue,
    high: copy.high,
    completed: copy.completed,
    trash: copy.trash,
  }), [copy]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const out: Row[] = [];
    const actions: Row[] = [
      { key: 'new-event', label: `${copy.newItem}: ${copy.event}`, hint: '', section: copy.cmdActions, run: () => handlers.current.onNew('event') },
      { key: 'new-task', label: `${copy.newItem}: ${copy.task}`, hint: '', section: copy.cmdActions, run: () => handlers.current.onNew('task') },
      { key: 'reminders', label: copy.reminders, hint: '', section: copy.cmdActions, run: () => handlers.current.onShowReminders() },
      { key: 'settings', label: copy.settings, hint: '', section: copy.cmdActions, run: () => handlers.current.onOpenSettings() },
      { key: 'lock', label: copy.lock, hint: '', section: copy.cmdActions, run: () => handlers.current.onLock() },
    ];
    for (const action of actions) {
      if (match(action.label)) out.push(action);
    }
    for (const filter of FILTERS) {
      if (match(labels[filter])) {
        out.push({ key: `go-${filter}`, label: labels[filter], hint: copy.cmdGo, section: copy.cmdGo, run: () => handlers.current.onGoFilter(filter) });
      }
    }
    if (q) {
      const hits = items
        .filter((item) => !item.deletedAt)
        .filter((item) => item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q))
        .slice(0, 30);
      for (const item of hits) {
        out.push({
          key: `item-${item.id}`,
          label: item.title,
          hint: formatDate(item.occurrenceAt || item.startAt, lang),
          section: copy.cmdItems,
          run: () => handlers.current.onOpenItem(item),
        });
      }
    }
    return out;
  }, [query, items, copy, lang, labels]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('.palette-row.selected')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Escape closes the palette no matter which element inside has the focus,
  // and Enter runs the highlighted row.
  useModalKeys(true, {
    esc: () => handlers.current.onClose(),
    enter: () => {
      const row = rows[active];
      if (row) run(row);
    },
  });

  function run(row: Row) {
    row.run();
    handlers.current.onClose();
  }

  function focusRow(index: number) {
    const nodes = listRef.current?.querySelectorAll<HTMLButtonElement>('.palette-row');
    nodes?.[index]?.focus();
  }

  function moveActive(next: number, moveFocus: boolean) {
    if (rows.length === 0) return;
    const clamped = Math.max(0, Math.min(next, rows.length - 1));
    setActive(clamped);
    if (moveFocus) focusRow(clamped);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const onRow = (event.target as HTMLElement).classList.contains('palette-row');
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(active + 1, onRow);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(active - 1, onRow);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveActive(0, onRow);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveActive(rows.length - 1, onRow);
    }
  }

  let lastSection = '';
  return (
    <DialogPanel
      className="palette"
      backdropClassName="palette-backdrop"
      label={copy.cmdSearch}
      dataOverlay="palette"
      onBackdropMouseDown={() => handlers.current.onClose()}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        value={query}
        aria-label={copy.cmdSearch}
        placeholder={copy.cmdSearch}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="palette-list" ref={listRef}>
        {rows.length === 0 && <div className="palette-empty">{copy.cmdEmpty}</div>}
        {rows.map((row, index) => {
          const header = row.section !== lastSection ? row.section : '';
          lastSection = row.section;
          return (
            <div key={row.key}>
              {header && <div className="palette-group">{header}</div>}
              <button
                type="button"
                className={`palette-row ${index === active ? 'selected' : ''}`}
                tabIndex={index === active ? 0 : -1}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => run(row)}
              >
                <span className="subject">{row.label}</span>
                {row.hint && <span className="muted">{row.hint}</span>}
              </button>
            </div>
          );
        })}
      </div>
    </DialogPanel>
  );
}
