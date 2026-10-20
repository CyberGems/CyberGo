import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Item, PublicSettings } from '@shared/types';
import { copyOf, type Copy } from '../i18n';
import { duePhrase, dueState, shortDuePhrase } from '../lib/format';
import { playAlert, stopAlert } from '../lib/sound';
import { applyTheme } from '../themes';
import TitleBar from './TitleBar';
import TextContextMenu from './TextContextMenu';
import Tooltip from './Tooltip';
import DialogPanel from './Dialog';
import LockScreen from './LockScreen';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';
import {
  BellRing, CalendarDays, CheckCircle2, CheckCheck, ChevronDown, Clock3, ExternalLink,
  Info, ListChecks, ListTodo, ListX, MoreHorizontal, Pin, SlidersHorizontal, Timer,
  Trash2, VolumeX, X, XCircle,
} from 'lucide-react';

/** The rectangle of a drag that selects the rows it touches. */
interface MarqueeRect {
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

/** Which reminders the list shows. */
type ReminderFilter = 'all' | 'overdue' | 'task' | 'event';

/** How late a reminder is, from the least to the most. */
type Gravity = 0 | 1 | 2 | 3;

/** How far the pointer has to travel before a click turns into a drag. */
const DRAG_THRESHOLD = 4;

function dueTime(item: Item): number {
  const t = new Date(item.occurrenceAt || item.nextFireAt || '').getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** The day a reminder belongs to, counted from today. */
function dayOffset(item: Item): number | null {
  const iso = item.occurrenceAt || item.nextFireAt;
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

/** How late a reminder is. The color of the row tells it at a glance. */
function gravityOf(item: Item): Gravity {
  const iso = item.occurrenceAt || item.nextFireAt;
  if (!iso) return 0;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return 0;
  const hours = (Date.now() - at) / 3_600_000;
  if (hours <= 0) return 0;
  if (hours < 24) return 1;
  if (hours < 72) return 2;
  return 3;
}

/**
 * Runs a request that nobody waits for.
 *
 * A failure has to be reported, otherwise it disappears without a word and
 * the interface looks like it did something it did not.
 */
function detach(promise: Promise<unknown>, what: string) {
  promise.catch((err) => console.error(`CyberGo could not ${what}`, err));
}

export default function RemindersWindow() {
  const api = window.cyberGoAPI;
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pulse, setPulse] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const previewModeRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirm, setConfirm] = useState<null | 'dismiss-all' | 'snooze-all'>(null);
  const [filter, setFilter] = useState<ReminderFilter>('all');
  const [snoozeFor, setSnoozeFor] = useState<null | { scope: 'selection' | 'all'; anchor: HTMLElement | null }>(null);
  const [amount, setAmount] = useState(8);
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [, setNow] = useState(() => Date.now());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pulseTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragHitsRef = useRef<string[]>([]);
  const skipClickRef = useRef(false);
  const lastDragRef = useRef(0);
  /** The row the selection started from, so Shift can extend it. */
  const anchorRef = useRef<string | null>(null);
  const copy = copyOf(settings?.language || 'es');

  async function reload(pulseIds: string[] = []) {
    const [due, boot] = await Promise.all([api.dueReminders(), api.getBootstrap()]);
    // A preview can arrive while this initial reload is in flight. Do not let
    // the empty real-data response overwrite the demo items.
    if (previewModeRef.current) return;
    setPreviewMode(false);
    setItems(due);
    if (!due.length) stopAlert();
    setSettings(boot.settings);
    setLocked(boot.locked);
    setHasPassword(boot.hasPassword);
    applyTheme(boot.settings.theme);
    setSelectedIds((previous) => {
      const valid = previous.filter((id) => due.some((item) => item.id === id));
      const pulsed = pulseIds.filter((id) => due.some((item) => item.id === id));
      if (pulsed.length) return pulsed;
      if (valid.length) return valid;
      return due[0] ? [due[0].id] : [];
    });
    if (pulseIds.length) {
      setPulse(pulseIds);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => {
        pulseTimer.current = null;
        setPulse([]);
      }, 1600);
    }
  }

  useEffect(() => {
    const offData = api.onDataChanged(() => void reload());
    const off = api.onReminderUpdate((payload) => {
      previewModeRef.current = false;
      void reload(payload.pulseIds);
      if (payload.sound) void playAlert();
    });
    const offPreview = api.onReminderPreview((payload) => {
      previewModeRef.current = true;
      setItems(payload.items);
      setSettings(payload.settings);
      setLocked(false);
      setHasPassword(true);
      setPreviewMode(true);
      setSelectedIds(payload.items[0] ? [payload.items[0].id] : []);
      setPulse([]);
      stopAlert();
      applyTheme(payload.settings.theme);
    });
    void reload();
    return () => {
      offData();
      off();
      offPreview();
      if (pulseTimer.current) {
        window.clearTimeout(pulseTimer.current);
        pulseTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const close = () => {
      setContextMenu(null);
      setMoreMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', close);
    };
  }, []);

  // Keep relative due phrases ("in 5 min", "overdue by ...") fresh while the window
  // stays open. A light 30s tick is enough for minute-level precision.
  useEffect(() => {
    if (!items.length || previewMode) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [items.length, previewMode]);

  /**
   * The rows a rectangle of the list touches.
   *
   * The rectangle lives in the coordinates of the list content, so a drag
   * keeps working while the list is scrolled.
   */
  function rowsInRect(rect: MarqueeRect): string[] {
    const list = listRef.current;
    if (!list) return [];
    const listRect = list.getBoundingClientRect();
    const hits: string[] = [];
    for (const row of Array.from(list.querySelectorAll<HTMLElement>('.reminder-row'))) {
      const rowRect = row.getBoundingClientRect();
      const top = rowRect.top - listRect.top + list.scrollTop;
      const left = rowRect.left - listRect.left + list.scrollLeft;
      const inside = top + rowRect.height > rect.top
        && top < rect.top + rect.height
        && left + rowRect.width > rect.left
        && left < rect.left + rect.width;
      if (!inside) continue;
      const id = row.getAttribute('data-id');
      if (id) hits.push(id);
    }
    return hits;
  }

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
      const listRect = list.getBoundingClientRect();
      const startLeft = drag.startX - listRect.left + list.scrollLeft;
      const startTop = drag.startY - listRect.top + list.scrollTop;
      const left = event.clientX - listRect.left + list.scrollLeft;
      const top = event.clientY - listRect.top + list.scrollTop;
      const rect: MarqueeRect = {
        left: Math.min(startLeft, left),
        top: Math.min(startTop, top),
        width: Math.abs(left - startLeft),
        height: Math.abs(top - startTop),
      };
      dragHitsRef.current = rowsInRect(rect);
      setMarquee(rect);
    }

    function up() {
      const drag = dragRef.current;
      dragRef.current = null;
      setMarquee(null);
      if (!drag || !drag.moved) return;
      // The click that ends the drag must not select the row under the pointer.
      skipClickRef.current = true;
      lastDragRef.current = Date.now();
      const hits = dragHitsRef.current;
      dragHitsRef.current = [];
      setSelectedIds((previous) => {
        if (!drag.additive) return hits;
        const merged = new Set([...drag.base, ...hits]);
        return previous.filter((id) => merged.has(id)).length === merged.size
          ? previous.filter((id) => !hits.includes(id))
          : [...merged];
      });
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, []);

  // Most urgent first: overdue items lead (oldest overdue at the top), then the
  // nearest upcoming ones. Items without a resolvable date sink to the bottom.
  const orderedItems = useMemo(
    () => [...items].sort((a, b) => dueTime(a) - dueTime(b)),
    [items],
  );

  const visibleItems = useMemo(() => {
    if (filter === 'overdue') return orderedItems.filter((item) => (dayOffset(item) ?? 0) < 0);
    if (filter === 'task') return orderedItems.filter((item) => item.kind === 'task');
    if (filter === 'event') return orderedItems.filter((item) => item.kind === 'event');
    return orderedItems;
  }, [orderedItems, filter]);

  const overdueCount = useMemo(
    () => orderedItems.filter((item) => (dayOffset(item) ?? 0) < 0).length,
    [orderedItems],
  );

  /** The visible reminders, split in the days they belong to. */
  const groups = useMemo(() => {
    const out: { id: string; label: string; items: Item[] }[] = [];
    for (const item of visibleItems) {
      const offset = dayOffset(item);
      const id = offset == null ? 'later' : offset < 0 ? 'overdue' : offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : offset <= 6 ? 'week' : 'later';
      const label = id === 'overdue' ? copy.groupOverdue
        : id === 'today' ? copy.groupToday
          : id === 'tomorrow' ? copy.groupTomorrow
            : id === 'week' ? copy.groupWeek : copy.groupLater;
      const last = out[out.length - 1];
      if (last && last.id === id) last.items.push(item);
      else out.push({ id, label, items: [item] });
    }
    return out;
  }, [visibleItems, copy]);

  const selectedItems = orderedItems.filter((item) => selectedIds.includes(item.id));
  const current = selectedItems[0] ?? null;
  const hasSingleSelection = selectedItems.length === 1;
  const allSelected = visibleItems.length > 0 && selectedIds.length === visibleItems.length;
  const minutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);
  const allTasks = selectedItems.length > 0 && selectedItems.every((item) => item.kind === 'task');
  const oldest = orderedItems[0] ?? null;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : visibleItems.map((item) => item.id));
  }

  function selectOnly(id: string) {
    setSelectedIds([id]);
  }

  function toggleOne(id: string) {
    setSelectedIds((previous) => (previous.includes(id)
      ? previous.filter((value) => value !== id)
      : [...previous, id]));
  }

  useModalKeys(Boolean(confirm), {
    esc: () => setConfirm(null),
    enter: () => {
      if (confirm === 'dismiss-all') detach(api.dismissAll(), 'dismiss every reminder');
      if (confirm === 'snooze-all') {
        for (const item of items) detach(api.snooze(item.id, minutes), 'snooze the reminder');
      }
      setConfirm(null);
    },
  });

  // Keyboard navigation: arrows move the selection, Enter opens, Delete/Backspace
  // dismisses, Ctrl+A selects everything. Ignored while typing in a field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (confirm) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const ids = visibleItems.map((item) => item.id);
      if (!ids.length) return;
      const index = selectedIds[0] ? ids.indexOf(selectedIds[0]) : -1;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const base = index < 0 ? (delta > 0 ? -1 : 0) : index;
        const next = ids[Math.max(0, Math.min(ids.length - 1, base + delta))];
        // Shift extends the selection from the row it started on.
        const anchor = anchorRef.current ? ids.indexOf(anchorRef.current) : -1;
        const target = ids.indexOf(next);
        if (event.shiftKey && anchor >= 0 && target >= 0) {
          const [from, to] = anchor <= target ? [anchor, target] : [target, anchor];
          setSelectedIds(ids.slice(from, to + 1));
        } else {
          anchorRef.current = next;
          setSelectedIds([next]);
        }
        rowRefs.current[next]?.focus();
      } else if (event.key === ' ') {
        // Space marks the focused row, the way a checkbox does.
        event.preventDefault();
        const focused = document.activeElement?.getAttribute('data-id');
        if (!focused) return;
        anchorRef.current = focused;
        setSelectedIds((previous) => (previous.includes(focused)
          ? previous.filter((id) => id !== focused)
          : [...previous, focused]));
      } else if (event.key === 'Enter') {
        if (previewMode || !current) return;
        event.preventDefault();
        detach(api.openItem(current.id), 'open the item');
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (previewMode || !current) return;
        event.preventDefault();
        for (const item of selectedItems) detach(api.dismiss(item.id), 'dismiss the reminder');
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        toggleSelectAll();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleItems, selectedIds, current, previewMode, selectedItems, allSelected, confirm]);

  function showContextMenu(event: ReactMouseEvent<HTMLElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const width = 190;
    const height = 190;
    setContextMenu({
      id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    });
  }

  function runContextAction(action: 'open' | 'dismiss' | 'delete' | 'dismiss-all') {
    const menu = contextMenu;
    setContextMenu(null);
    if (!menu) return;
    if (action === 'open') detach(api.openItem(menu.id), 'open the item');
    if (action === 'dismiss') detach(api.dismiss(menu.id), 'dismiss the reminder');
    if (action === 'delete') detach(api.deleteItem(menu.id), 'delete the item');
    if (action === 'dismiss-all') setConfirm('dismiss-all');
  }

  /** The actions of the footer always work on the whole selection. */
  function actOnSelection(what: 'open' | 'dismiss' | 'complete') {
    if (previewMode || !selectedItems.length) return;
    if (what === 'open') {
      if (!hasSingleSelection) return;
      detach(api.openItem(current!.id), 'open the item');
      return;
    }
    for (const item of selectedItems) {
      if (what === 'dismiss') detach(api.dismiss(item.id), 'dismiss the reminder');
      if (what === 'complete') detach(api.completeItem(item.id), 'complete the item');
    }
  }

  /** The snooze menu acts on the selection, or on every reminder. */
  function snoozeTargets(): Item[] {
    return snoozeFor?.scope === 'all' ? items : selectedItems;
  }

  function snoozeEverything(minutesToSnooze: number) {
    for (const item of snoozeTargets()) {
      detach(api.snooze(item.id, minutesToSnooze), 'snooze the reminder');
    }
    setSnoozeFor(null);
  }

  function snoozeEverythingUntilTomorrow() {
    for (const item of snoozeTargets()) {
      detach(api.snoozeTomorrow(item.id), 'snooze the reminder');
    }
    setSnoozeFor(null);
  }

  /**
   * The content of the reminders does not show while the session is locked.
   *
   * The window shows the lock instead, so the reminder is announced without
   * leaving the agenda on the screen. The user can unlock right there.
   */
  const showLock = locked && settings?.lockLevel !== 'visible';

  const filters: { id: ReminderFilter; label: string }[] = [
    { id: 'all', label: copy.filterAll },
    { id: 'overdue', label: copy.filterOverdue },
    { id: 'task', label: copy.filterTasks },
    { id: 'event', label: copy.filterEvents },
  ];

  return (
    <div className="reminder-app">
      <TitleBar
        title={copy.remindersTitle}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      />
      <div className="reminder-body">
        {showLock ? (
          <LockScreen
            copy={copy}
            hint={settings?.passwordHint ?? ''}
            method={settings?.authMethod ?? 'password'}
            hasPassword={hasPassword}
            compact
          />
        ) : (
        <>
        {previewMode && (
          <div className="reminder-preview-banner" role="status">
            <Info size={15} />
            <span><strong>{copy.previewBannerTitle}.</strong> {copy.previewBannerBody}</span>
          </div>
        )}
        {!items.length ? (
          <div className="reminder-empty">
            <div>
              <div className="reminder-empty-icon"><CheckCircle2 size={22} /></div>
              <h2>{copy.noPending}</h2>
              <p>{copy.noPendingBody}</p>
            </div>
          </div>
        ) : (
          <>
            <header className="reminder-head">
              <div className="reminder-heading">
                <span className="reminder-mark"><BellRing size={15} /></span>
                <h1>{copy.remindersTitle}</h1>
                <span className="reminder-count">{items.length}</span>
                {overdueCount > 0 && (
                  <span className="reminder-count is-overdue" title={`${overdueCount} ${copy.overdueCount}`}>
                    {overdueCount} {copy.overdueCount}
                  </span>
                )}
              </div>
              <div className="reminder-head-actions">
                <Tooltip label={allSelected ? copy.clearSelection : copy.selectAll} placement="bottom">
                  <button
                    type="button"
                    className={`head-action ${allSelected ? 'active' : ''}`}
                    aria-pressed={allSelected}
                    aria-label={allSelected ? copy.clearSelection : copy.selectAll}
                    onClick={toggleSelectAll}
                  >
                    {allSelected ? <ListX size={15} /> : <ListChecks size={15} />}
                  </button>
                </Tooltip>
                <Tooltip label={copy.stopSound} placement="bottom">
                  <button type="button" className="head-action" onClick={stopAlert} aria-label={copy.stopSound}><VolumeX size={15} /></button>
                </Tooltip>
                <Tooltip label={copy.moreActions} placement="bottom">
                  <button
                    type="button"
                    className={`head-action ${moreMenu ? 'active' : ''}`}
                    aria-label={copy.moreActions}
                    aria-expanded={Boolean(moreMenu)}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMoreMenu((current) => (current ? null : { x: rect.right - 180, y: rect.bottom + 6 }));
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </Tooltip>
                <Tooltip label={copy.alwaysOnTop} placement="bottom">
                  <button
                    type="button"
                    className={`head-action ${settings?.reminderAlwaysOnTop ? 'active' : ''}`}
                    aria-pressed={settings?.reminderAlwaysOnTop ?? true}
                    aria-label={copy.alwaysOnTop}
                    onClick={() => void api.setAlwaysOnTop(!(settings?.reminderAlwaysOnTop ?? true))}
                  >
                    <Pin size={15} />
                  </button>
                </Tooltip>
                <Tooltip label={`${copy.multiSelectHint} · ${copy.dragSelectHint} · ${copy.keyboardHint}`} placement="bottom">
                  <button type="button" className="head-action" aria-label={copy.keyboardHint}><Info size={15} /></button>
                </Tooltip>
              </div>
            </header>

            <div className="reminder-filters" role="group" aria-label={copy.filters}>
              {filters.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`chip ${filter === entry.id ? 'on' : ''}`}
                  aria-pressed={filter === entry.id}
                  onClick={() => setFilter(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div
              className="reminder-list"
              role="listbox"
              aria-multiselectable="true"
              aria-label={copy.remindersTitle}
              ref={listRef}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                skipClickRef.current = false;
                dragRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  moved: false,
                  additive: event.ctrlKey || event.metaKey || event.shiftKey,
                  base: selectedIds,
                };
              }}
            >
              {groups.map((group) => (
                <div className="reminder-group" key={group.id} role="group" aria-label={group.label}>
                  <div className="reminder-group-head">
                    <span>{group.label}</span>
                    <span className="reminder-group-count">{group.items.length}</span>
                  </div>
                  {group.items.map((item) => {
                    const state = dueState(item.occurrenceAt || item.nextFireAt) ?? 'future';
                    const selected = selectedIds.includes(item.id);
                    const inDrag = dragHitsRef.current.includes(item.id);
                    const gravity = gravityOf(item);
                    return (
                      <div
                        key={item.id}
                        data-id={item.id}
                        ref={(el) => { rowRefs.current[item.id] = el; }}
                        role="option"
                        aria-selected={selected}
                        tabIndex={0}
                        className={`reminder-row urgency-${state} gravity-${gravity} ${selected ? 'selected' : ''} ${inDrag ? 'in-drag' : ''} ${pulse.includes(item.id) ? 'pulse' : ''}`}
                        onClick={(event) => {
                          if (skipClickRef.current) {
                            skipClickRef.current = false;
                            return;
                          }
                          if (event.ctrlKey || event.metaKey) {
                            anchorRef.current = item.id;
                            toggleOne(item.id);
                          } else {
                            anchorRef.current = item.id;
                            selectOnly(item.id);
                          }
                        }}
                        onDoubleClick={() => {
                          // A drag that ends on a row would otherwise count as the
                          // first click of a double click, and the item would open.
                          if (Date.now() - lastDragRef.current < 300) return;
                          if (!previewMode) detach(api.openItem(item.id), 'open the item');
                        }}
                        onContextMenu={(event) => showContextMenu(event, item.id)}
                      >
                        <span className="reminder-row-icon">
                          {item.kind === 'event' ? <CalendarDays size={14} /> : <ListTodo size={14} />}
                        </span>
                        <span className="reminder-row-title subject">{item.title}</span>
                        <span className="reminder-row-due">{shortDuePhrase(item.occurrenceAt || item.nextFireAt, copy)}</span>
                        <span className="reminder-row-actions" onClick={(event) => event.stopPropagation()}>
                          <Tooltip label={copy.min10} placement="top">
                            <button type="button" className="row-action" disabled={previewMode} aria-label={`${copy.snoozeFor}: ${copy.min10}`} onClick={() => detach(api.snooze(item.id, 10), 'snooze the reminder')}>
                              <Clock3 size={14} />
                            </button>
                          </Tooltip>
                          {item.kind === 'task' && (
                            <Tooltip label={copy.markComplete} placement="top">
                              <button type="button" className="row-action" disabled={previewMode} aria-label={copy.markComplete} onClick={() => detach(api.completeItem(item.id), 'complete the item')}>
                                <CheckCircle2 size={14} />
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip label={copy.dismiss} placement="top">
                            <button type="button" className="row-action" disabled={previewMode} aria-label={copy.dismiss} onClick={() => detach(api.dismiss(item.id), 'dismiss the reminder')}>
                              <X size={14} />
                            </button>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {marquee && (
                <div
                  className="reminder-marquee"
                  aria-hidden="true"
                  style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
                />
              )}
              {visibleItems.length === 0 && (
                <p className="reminder-filter-empty">{copy.noPendingBody}</p>
              )}
              <div className="reminder-summary">
                <div className="reminder-summary-line">
                  <strong>{items.length}</strong> {copy.remindersTitle.toLowerCase()}
                  {overdueCount > 0 && <span className="reminder-summary-overdue"> · {overdueCount} {copy.overdueCount}</span>}
                </div>
                {oldest && (
                  <p className="reminder-summary-oldest">
                    {copy.oldestReminder}: {shortDuePhrase(oldest.occurrenceAt || oldest.nextFireAt, copy)}
                  </p>
                )}
                <div className="reminder-summary-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={previewMode || !items.length}
                    onClick={(event) => setSnoozeFor({ scope: 'all', anchor: event.currentTarget })}
                  >
                    <Timer size={13} />{copy.snoozeAll}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={previewMode || !items.length}
                    onClick={() => setConfirm('dismiss-all')}
                  >
                    <XCircle size={13} />{copy.dismissAll}
                  </button>
                </div>
              </div>
            </div>

            {selectedItems.length > 0 && (
              <div className="reminder-inspector">
                <div className="reminder-inspector-info">
                  <span className={`reminder-inspector-icon ${current ? `urgency-${dueState(current.occurrenceAt || current.nextFireAt) ?? 'future'}` : 'is-empty'}`}>
                    {current
                      ? (current.kind === 'event' ? <CalendarDays size={15} /> : <ListTodo size={15} />)
                      : <BellRing size={15} />}
                  </span>
                  <span className="reminder-inspector-title">
                    {selectedItems.length > 1
                      ? `${selectedItems.length} ${copy.selectedItems}`
                      : current
                        ? current.title
                        : copy.pickReminder}
                  </span>
                  {selectedItems.length === 1 && current && (
                    <span className={`reminder-inspector-due urgency-${dueState(current.occurrenceAt || current.nextFireAt) ?? 'future'}`}>
                      {duePhrase(current.occurrenceAt || current.nextFireAt, copy)}
                    </span>
                  )}
                </div>
                <div className="reminder-inspector-actions">
                  <Tooltip label={copy.openItem} placement="top">
                    <button
                      type="button"
                      className="inspector-action"
                      disabled={previewMode || !hasSingleSelection}
                      aria-label={copy.openItem}
                      onClick={() => actOnSelection('open')}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip label={copy.snoozeFor} placement="top">
                    <button
                      type="button"
                      className={`inspector-action ${snoozeFor?.scope === 'selection' ? 'active' : ''}`}
                      disabled={previewMode || !selectedItems.length}
                      aria-label={copy.snoozeFor}
                      aria-expanded={snoozeFor?.scope === 'selection'}
                      onClick={(event) => setSnoozeFor({ scope: 'selection', anchor: event.currentTarget })}
                    >
                      <Timer size={14} />
                      <ChevronDown size={11} />
                    </button>
                  </Tooltip>
                  {allTasks && (
                    <Tooltip label={copy.markComplete} placement="top">
                      <button
                        type="button"
                        className="inspector-action"
                        disabled={previewMode || !selectedItems.length}
                        aria-label={copy.markComplete}
                        onClick={() => actOnSelection('complete')}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip label={copy.dismiss} placement="top">
                    <button
                      type="button"
                      className="inspector-action"
                      disabled={previewMode || !selectedItems.length}
                      aria-label={copy.dismiss}
                      onClick={() => actOnSelection('dismiss')}
                    >
                      <X size={14} />
                    </button>
                  </Tooltip>
                  <span className="reminder-selection-count">
                    <CheckCheck size={13} />
                    {selectedItems.length}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>

      {snoozeFor && (
        <SnoozeMenu
          copy={copy}
          anchor={snoozeFor.anchor}
          amount={amount}
          unit={unit}
          onAmount={setAmount}
          onUnit={setUnit}
          onPreset={(value) => {
            if (value === 'tomorrow') snoozeEverythingUntilTomorrow();
            else snoozeEverything(value);
          }}
          onCustom={(value) => {
            for (const item of snoozeTargets()) detach(api.snooze(item.id, value), 'snooze the reminder');
            setSnoozeFor(null);
          }}
          onClose={() => setSnoozeFor(null)}
        />
      )}

      {moreMenu && (
        <div
          className="text-context-menu reminder-more-menu"
          role="menu"
          aria-label={copy.moreActions}
          style={{ left: moreMenu.x, top: moreMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="text-context-menu-item"
            disabled={previewMode || !items.length}
            onClick={() => {
              setMoreMenu(null);
              setSnoozeFor({ scope: 'all', anchor: null });
            }}
          >
            <Timer size={15} />
            <span>{copy.snoozeAll}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="text-context-menu-item"
            disabled={previewMode || !items.length}
            onClick={() => { setMoreMenu(null); setConfirm('dismiss-all'); }}
          >
            <XCircle size={15} />
            <span>{copy.dismissAll}</span>
          </button>
        </div>
      )}

      {confirm && (
        <DialogPanel
          className="modal narrow"
          labelledBy="reminder-confirm-title"
          focusTarget="container"
          onBackdropMouseDown={() => setConfirm(null)}
        >
          <h2 id="reminder-confirm-title">
            {confirm === 'dismiss-all' ? copy.confirmDismissAllTitle : copy.confirmSnoozeAllTitle}
          </h2>
          <p>
            {(confirm === 'dismiss-all' ? copy.confirmDismissAllBody : copy.confirmSnoozeAllBody)
              .replace('{count}', String(items.length))}
          </p>
          <div className="row-actions">
            <button className="btn" onClick={() => setConfirm(null)}>{copy.cancel}<EscHint /></button>
            <button
              className={`btn ${confirm === 'dismiss-all' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                if (confirm === 'dismiss-all') detach(api.dismissAll(), 'dismiss every reminder');
                if (confirm === 'snooze-all') {
                  for (const item of items) detach(api.snooze(item.id, minutes), 'snooze the reminder');
                }
                setConfirm(null);
              }}
            >
              {confirm === 'dismiss-all' ? copy.confirmDismissAllAction : copy.confirmSnoozeAllAction}
              <EnterGlyph />
            </button>
          </div>
        </DialogPanel>
      )}

      <TextContextMenu copy={copy} />
      {contextMenu && (
        <div
          className="text-context-menu reminder-context-menu"
          role="menu"
          aria-label={copy.reminderContextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('open')}>
            <ExternalLink size={15} />
            <span>{copy.openItem}</span>
          </button>
          <button type="button" role="menuitem" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('dismiss')}>
            <X size={15} />
            <span>{copy.dismiss}</span>
          </button>
          <div className="text-context-menu-separator" />
          <button type="button" role="menuitem" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('delete')}>
            <Trash2 size={15} />
            <span>{copy.delete}</span>
          </button>
          <div className="text-context-menu-separator" />
          <button type="button" role="menuitem" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('dismiss-all')}>
            <XCircle size={15} />
            <span>{copy.dismissAll}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The menu of the snooze, with the presets and a custom amount.
 *
 * It opens above the button that asked for it, and it never leaves the
 * window.
 */
function SnoozeMenu({
  copy,
  anchor,
  amount,
  unit,
  onAmount,
  onUnit,
  onPreset,
  onCustom,
  onClose,
}: {
  copy: Copy;
  anchor: HTMLElement | null;
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
  onAmount: (value: number) => void;
  onUnit: (value: 'minutes' | 'hours' | 'days') => void;
  onPreset: (value: number | 'tomorrow') => void;
  onCustom: (minutes: number) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    function place() {
      const box = boxRef.current;
      if (!box) return;
      const width = box.getBoundingClientRect().width;
      const rect = anchor?.getBoundingClientRect();
      const left = rect ? Math.min(Math.max(8, rect.left), window.innerWidth - width - 8) : 8;
      const bottom = rect ? Math.max(8, window.innerHeight - rect.top + 6) : 8;
      setPosition({ left, bottom });
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    function away(event: MouseEvent) {
      if (boxRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', escape);
    };
  }, [onClose]);

  const customMinutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);

  return createPortal(
    <div
      className="snooze-menu"
      role="menu"
      aria-label={copy.snoozeFor}
      ref={boxRef}
      style={{ left: position?.left ?? -9999, bottom: position?.bottom ?? -9999 }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => onPreset(10)}>
        {copy.min10}
      </button>
      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => onPreset(60)}>
        {copy.hour1}
      </button>
      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => onPreset('tomorrow')}>
        {copy.tomorrow9}
      </button>
      <div className="text-context-menu-separator" />
      <div className="snooze-menu-custom">
        <input type="number" min={1} value={amount} aria-label={copy.snoozeAmount} onChange={(e) => onAmount(Number(e.target.value))} />
        <select value={unit} aria-label={copy.snoozeUnit} onChange={(e) => onUnit(e.target.value as 'minutes' | 'hours' | 'days')}>
          <option value="minutes">{copy.minutes}</option>
          <option value="hours">{copy.hours}</option>
          <option value="days">{copy.days}</option>
        </select>
        <Tooltip label={copy.snooze} placement="top">
          <button
            type="button"
            className="btn btn-primary snooze-menu-apply"
            aria-label={copy.applySnooze}
            onClick={() => onCustom(customMinutes)}
          >
            <SlidersHorizontal size={13} />
          </button>
        </Tooltip>
      </div>
    </div>,
    document.body,
  );
}
