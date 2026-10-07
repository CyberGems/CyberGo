import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Item, PublicSettings } from '@shared/types';
import { copyOf } from '../i18n';
import { duePhrase, dueState } from '../lib/format';
import { playAlert, stopAlert } from '../lib/sound';
import { applyTheme } from '../themes';
import TitleBar from './TitleBar';
import TextContextMenu from './TextContextMenu';
import Tooltip from './Tooltip';
import { BellRing, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, Info, ListTodo, SlidersHorizontal, Timer, Trash2, VolumeX, X, XCircle } from 'lucide-react';

function dueTime(item: Item): number {
  const t = new Date(item.occurrenceAt || item.nextFireAt || '').getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
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
  const [customOpen, setCustomOpen] = useState(false);
  const [, setNow] = useState(() => Date.now());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
      window.setTimeout(() => setPulse([]), 1600);
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
    return () => { offData(); off(); offPreview(); };
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

  // Most urgent first: overdue items lead (oldest overdue at the top), then the
  // nearest upcoming ones. Items without a resolvable date sink to the bottom.
  const orderedItems = useMemo(
    () => [...items].sort((a, b) => dueTime(a) - dueTime(b)),
    [items],
  );

  const selectedItems = orderedItems.filter((item) => selectedIds.includes(item.id));
  const current = selectedItems[0] ?? null;
  const hasSingleSelection = selectedItems.length === 1;
  const minutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);

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
        setSelectedIds([next]);
        rowRefs.current[next]?.focus();
      } else if (event.key === 'Enter') {
        if (previewMode || !current) return;
        event.preventDefault();
        void api.openItem(current.id);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (previewMode || !current) return;
        event.preventDefault();
        void api.dismiss(current.id);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(ids);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orderedItems, selectedIds, current, previewMode]);

  function showContextMenu(event: MouseEvent<HTMLElement>, id: string) {
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
    if (action === 'open') void api.openItem(menu.id);
    if (action === 'dismiss') void api.dismiss(menu.id);
    if (action === 'delete') void api.deleteItem(menu.id);
    if (action === 'dismiss-all') void api.dismissAll();
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
                <span className="reminder-mark"><BellRing size={18} /></span>
                <div className="reminder-heading-copy">
                  <p>{previewMode ? copy.notificationPreviewDemo : current ? duePhrase(current.occurrenceAt || current.nextFireAt, settings?.language || 'es') : copy.remindersTitle}</p>
                  <h1>{copy.remindersTitle}</h1>
                </div>
              </div>
              <span className="reminder-count">{items.length}</span>
            </header>
            <div className="reminder-list" role="listbox" aria-multiselectable aria-label={copy.remindersTitle}>
              {orderedItems.map((item) => {
                const state = dueState(item.occurrenceAt || item.nextFireAt) ?? 'future';
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    ref={(el) => { rowRefs.current[item.id] = el; }}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    className={`reminder-row urgency-${state} ${selected ? 'selected' : ''} ${pulse.includes(item.id) ? 'pulse' : ''}`}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey) {
                        setSelectedIds((previous) => previous.includes(item.id)
                          ? previous.filter((id) => id !== item.id)
                          : [...previous, item.id]);
                      } else {
                        setSelectedIds([item.id]);
                      }
                    }}
                    onDoubleClick={() => { if (!previewMode) void api.openItem(item.id); }}
                    onContextMenu={(event) => showContextMenu(event, item.id)}
                  >
                    <span className="reminder-row-icon">
                      {item.kind === 'event' ? <CalendarDays size={15} /> : <ListTodo size={15} />}
                    </span>
                    <span className="reminder-row-content">
                      <span className="reminder-row-top"><strong className="subject">{item.title}</strong></span>
                      <span className="reminder-row-meta">
                        <span className="reminder-row-due">{duePhrase(item.occurrenceAt || item.nextFireAt, settings?.language || 'es')}</span>
                        <span className="reminder-row-kind">{item.kind === 'event' ? copy.event : copy.task}</span>
                      </span>
                    </span>
                    <span className="reminder-row-actions" onClick={(event) => event.stopPropagation()}>
                      <Tooltip label={copy.min10} placement="top">
                        <button type="button" className="row-action" disabled={previewMode} aria-label={`${copy.snoozeFor}: ${copy.min10}`} onClick={() => void api.snooze(item.id, 10)}>
                          <Clock3 size={14} />
                        </button>
                      </Tooltip>
                      {item.kind === 'task' && (
                        <Tooltip label={copy.markComplete} placement="top">
                          <button type="button" className="row-action" disabled={previewMode} aria-label={copy.markComplete} onClick={() => void api.completeItem(item.id)}>
                            <CheckCircle2 size={14} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label={copy.dismiss} placement="top">
                        <button type="button" className="row-action" disabled={previewMode} aria-label={copy.dismiss} onClick={() => void api.dismiss(item.id)}>
                          <X size={14} />
                        </button>
                      </Tooltip>
                    </span>
                    <ChevronRight className="reminder-row-chevron" size={15} />
                  </div>
                );
              })}
            </div>
            <div className="reminder-selection">
              <p className="reminder-selection-kicker">
                {selectedItems.length > 1
                  ? `${selectedItems.length} ${copy.selectedItems}`
                  : current?.kind === 'event'
                    ? copy.selectedEvent
                    : current
                      ? copy.selectedTask
                      : copy.selectedReminder}
              </p>
              <h2 className="reminder-selection-title">
                {selectedItems.length > 1 ? `${selectedItems.length} ${copy.itemMany}` : current ? current.title : copy.pickReminder}
              </h2>
              {selectedItems.length === 1 && current && (
                <p className="reminder-selection-due">{duePhrase(current.occurrenceAt || current.nextFireAt, settings?.language || 'es')}</p>
              )}
            </div>
            <p className="reminder-hint">{copy.multiSelectHint} · {copy.keyboardHint}</p>
            <footer className="reminder-foot">
              <div className="reminder-actions">
                <button type="button" className="btn" onClick={stopAlert}><VolumeX size={14} />{copy.stopSound}</button>
                <button type="button" className="btn" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.openItem(current.id)}><ExternalLink size={14} />{copy.openItem}</button>
                <button type="button" className="btn" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.dismiss(current.id)}><X size={14} />{copy.dismiss}</button>
                <button type="button" className="btn btn-danger" disabled={previewMode || !items.length} onClick={() => void api.dismissAll()}><XCircle size={14} />{copy.dismissAll}</button>
                <label className="check reminder-aot">
                  <input
                    type="checkbox"
                    checked={settings?.reminderAlwaysOnTop ?? true}
                    onChange={(e) => void api.setAlwaysOnTop(e.target.checked)}
                  />
                  {copy.alwaysOnTop}
                </label>
              </div>
              <div className="reminder-snooze">
                <span className="reminder-snooze-label">{copy.snoozeFor}</span>
                <button type="button" className="btn" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.snooze(current.id, 10)}><Clock3 size={13} />{copy.min10}</button>
                <button type="button" className="btn" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.snooze(current.id, 60)}>{copy.hour1}</button>
                <button type="button" className="btn" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.snoozeTomorrow(current.id)}>{copy.tomorrow9}</button>
                <button type="button" className="btn reminder-custom-toggle" aria-expanded={customOpen} onClick={() => setCustomOpen((v) => !v)}>
                  <SlidersHorizontal size={14} />{copy.custom}{customOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>
              {customOpen && (
                <div className="reminder-custom">
                  <input type="number" min={1} value={amount} aria-label={copy.snoozeFor} onChange={(e) => setAmount(Number(e.target.value))} />
                  <select value={unit} aria-label={copy.snoozeFor} onChange={(e) => setUnit(e.target.value as 'minutes' | 'hours' | 'days')}>
                    <option value="minutes">{copy.minutes}</option>
                    <option value="hours">{copy.hours}</option>
                    <option value="days">{copy.days}</option>
                  </select>
                  <button type="button" className="btn btn-primary" disabled={previewMode || !hasSingleSelection} onClick={() => current && void api.snooze(current.id, minutes)}><Timer size={14} />{copy.snooze}</button>
                </div>
              )}
            </footer>
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
          <button type="button" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('open')}>
            <ExternalLink size={15} />
            <span>{copy.openItem}</span>
          </button>
          <button type="button" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('dismiss')}>
            <X size={15} />
            <span>{copy.dismiss}</span>
          </button>
          <div className="text-context-menu-separator" />
          <button type="button" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('delete')}>
            <Trash2 size={15} />
            <span>{copy.delete}</span>
          </button>
          <div className="text-context-menu-separator" />
          <button type="button" className="text-context-menu-item" disabled={previewMode} onClick={() => runContextAction('dismiss-all')}>
            <XCircle size={15} />
            <span>{copy.dismissAll}</span>
          </button>
        </div>
      )}
    </div>
  );
}
