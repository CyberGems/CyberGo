import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Lang } from '@shared/types';
import type { Copy } from '../i18n';
import { formatDate } from '../lib/format';
import type { FilterId } from '../lib/view';

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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const labels: Record<FilterId, string> = {
    all: copy.all,
    today: copy.today,
    next7: copy.next7,
    next30: copy.next30,
    upcoming: copy.upcoming,
    overdue: copy.overdue,
    high: copy.high,
    completed: copy.completed,
    trash: copy.trash,
  };

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const out: Row[] = [];
    const actions: Row[] = [
      { key: 'new-event', label: `${copy.newItem}: ${copy.event}`, hint: '', section: copy.cmdActions, run: () => onNew('event') },
      { key: 'new-task', label: `${copy.newItem}: ${copy.task}`, hint: '', section: copy.cmdActions, run: () => onNew('task') },
      { key: 'reminders', label: copy.reminders, hint: '', section: copy.cmdActions, run: onShowReminders },
      { key: 'settings', label: copy.settings, hint: '', section: copy.cmdActions, run: onOpenSettings },
      { key: 'lock', label: copy.lock, hint: '', section: copy.cmdActions, run: onLock },
    ];
    for (const action of actions) {
      if (match(action.label)) out.push(action);
    }
    for (const filter of FILTERS) {
      if (match(labels[filter])) {
        out.push({ key: `go-${filter}`, label: labels[filter], hint: copy.cmdGo, section: copy.cmdGo, run: () => onGoFilter(filter) });
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
          run: () => onOpenItem(item),
        });
      }
    }
    return out;
  }, [query, items, copy, lang, labels, onNew, onGoFilter, onShowReminders, onLock, onOpenSettings, onOpenItem]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('.palette-row.selected')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function run(row: Row) {
    row.run();
    onClose();
  }

  let lastSection = '';
  return (
    <div className="backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder={copy.cmdSearch}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const row = rows[active];
              if (row) run(row);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
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
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(row)}
                >
                  <span className="subject">{row.label}</span>
                  {row.hint && <span className="muted">{row.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
