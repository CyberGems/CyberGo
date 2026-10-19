import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Item, PublicSettings } from '@shared/types';
import { copyOf } from '../i18n';
import { duePhrase, dueState, shortDuePhrase } from '../lib/format';
import { playAlert, stopAlert } from '../lib/sound';
import { applyTheme } from '../themes';
import TitleBar from './TitleBar';
import TextContextMenu from './TextContextMenu';
import Tooltip from './Tooltip';
import {
  BellRing, CalendarDays, CheckCircle2, CheckCheck, ChevronDown, Clock3, ExternalLink,
  Info, ListChecks, ListTodo, ListX, Pin, SlidersHorizontal, Timer, Trash2, VolumeX, X, XCircle,
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

/** How far the pointer has to travel before a click turns into a drag. */
const DRAG_THRESHOLD = 4;

function dueTime(item: Item): number {
  const t = new Date(item.occurrenceAt || item.nextFireAt || '').getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pulse, setPulse] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const previewModeRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [amount, setAmount] = useState(8);
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
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
    const close = () => setContextMenu(null);
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

  const selectedItems = orderedItems.filter((item) => selectedIds.includes(item.id));
  const current = selectedItems[0] ?? null;
  const hasSingleSelection = selectedItems.length === 1;
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const minutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);
  const allTasks = selectedItems.length > 0 && selectedItems.every((item) => item.kind === 'task');

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  }

  function selectOnly(id: string) {
    setSelectedIds([id]);
  }

  function toggleOne(id: string) {
    setSelectedIds((previous) => (previous.includes(id)
      ? previous.filter((value) => value !== id)
      : [...previous, id]));
  }

  // Keyboard navigation: arrows move the selection, Enter opens, Delete/Backspace
  // dismisses, Ctrl+A selects everything. Ignored while typing in a field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const ids = orderedItems.map((item) => item.id);
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
  }, [orderedItems, selectedIds, current, previewMode, selectedItems, allSelected, items]);

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
    if (action === 'dismiss-all') detach(api.dismissAll(), 'dismiss every reminder');
  }

  /** The actions of the footer always work on the whole selection. */
  function actOnSelection(what: 'open' | 'dismiss' | 'complete' | 'snooze') {
    if (previewMode || !selectedItems.length) return;
    if (what === 'open') {
      if (!hasSingleSelection) return;
      detach(api.openItem(current!.id), 'open the item');
      return;
    }
    for (const item of selectedItems) {
      if (what === 'dismiss') detach(api.dismiss(item.id), 'dismiss the reminder');
      if (what === 'complete') detach(api.completeItem(item.id), 'complete the item');
      if (what === 'snooze') detach(api.snooze(item.id, minutes), 'snooze the reminder');
    }
  }

  return (
    <div className="reminder-app">
      <TitleBar
        title={copy.remindersTitle}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      />
      <div className="reminder-body">
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
                <Tooltip label={copy.dismissAll} placement="bottom">
                  <button type="button" className="head-action" disabled={previewMode || !items.length} onClick={() => detach(api.dismissAll(), 'dismiss every reminder')} aria-label={copy.dismissAll}><XCircle size={15} /></button>
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
              {orderedItems.map((item) => {
                const state = dueState(item.occurrenceAt || item.nextFireAt) ?? 'future';
                const selected = selectedIds.includes(item.id);
                const inDrag = dragHitsRef.current.includes(item.id);
                return (
                  <div
                    key={item.id}
                    data-id={item.id}
                    ref={(el) => { rowRefs.current[item.id] = el; }}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    className={`reminder-row urgency-${state} ${selected ? 'selected' : ''} ${inDrag ? 'in-drag' : ''} ${pulse.includes(item.id) ? 'pulse' : ''}`}
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
              {marquee && (
                <div
                  className="reminder-marquee"
                  aria-hidden="true"
                  style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
                />
              )}
            </div>

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
                <div className="snooze-holder">
                  <Tooltip label={copy.snoozeFor} placement="top">
                    <button
                      type="button"
                      className={`inspector-action ${snoozeOpen ? 'active' : ''}`}
                      disabled={previewMode || !selectedItems.length}
                      aria-label={copy.snooze}
                      aria-expanded={snoozeOpen}
                      onClick={() => setSnoozeOpen((value) => !value)}
                    >
                      <Timer size={14} />
                      <ChevronDown size={11} />
                    </button>
                  </Tooltip>
                  {snoozeOpen && (
                    <div className="snooze-menu" role="menu" aria-label={copy.snoozeFor}>
                      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => { setSnoozeOpen(false); for (const item of selectedItems) detach(api.snooze(item.id, 10), 'snooze the reminder'); }}>
                        {copy.min10}
                      </button>
                      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => { setSnoozeOpen(false); for (const item of selectedItems) detach(api.snooze(item.id, 60), 'snooze the reminder'); }}>
                        {copy.hour1}
                      </button>
                      <button type="button" role="menuitem" className="snooze-menu-item" onClick={() => { setSnoozeOpen(false); for (const item of selectedItems) detach(api.snoozeTomorrow(item.id), 'snooze the reminder'); }}>
                        {copy.tomorrow9}
                      </button>
                      <div className="text-context-menu-separator" />
                      <div className="snooze-menu-custom">
                        <input type="number" min={1} value={amount} aria-label={copy.snoozeAmount} onChange={(e) => setAmount(Number(e.target.value))} />
                        <select value={unit} aria-label={copy.snoozeUnit} onChange={(e) => setUnit(e.target.value as 'minutes' | 'hours' | 'days')}>
                          <option value="minutes">{copy.minutes}</option>
                          <option value="hours">{copy.hours}</option>
                          <option value="days">{copy.days}</option>
                        </select>
                        <Tooltip label={copy.snooze} placement="top">
                          <button
                            type="button"
                            className="btn btn-primary snooze-menu-apply"
                            disabled={previewMode || !selectedItems.length}
                            aria-label={copy.applySnooze}
                            onClick={() => { setSnoozeOpen(false); for (const item of selectedItems) detach(api.snooze(item.id, minutes), 'snooze the reminder'); }}
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
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
                {selectedItems.length > 1 && (
                  <span className="reminder-selection-count">
                    <CheckCheck size={13} />
                    {selectedItems.length}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
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
