import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Bell, CalendarDays, Check, Command, Download, Flame, Info, List, ListChecks, ListX, Lock, Pencil, Plus, Power, Search, Settings, Trash2, X } from 'lucide-react';
import type { AppInfo, Bootstrap, Item, ItemDraft, RecoveryNotice } from '@shared/types';
import { formatLocalInput } from '@shared/schedule';
import { copyOf, type Copy } from './i18n';
import { matchesFilter, sortByColumn, sortItems, type FilterId, type SortColumn, type SortDirection } from './lib/view';
import { computeStats } from './lib/stats';
import { applyTheme } from './themes';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ItemTable from './components/ItemTable';
import CalendarView from './components/CalendarView';
import ItemModal from './components/ItemModal';
import CommandPalette from './components/CommandPalette';
import QuickAdd from './components/QuickAdd';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import LockScreen from './components/LockScreen';
import RemindersWindow from './components/RemindersWindow';
import TextContextMenu from './components/TextContextMenu';
import Tooltip from './components/Tooltip';
import DialogPanel from './components/Dialog';
import { EnterGlyph, EscHint, KeyHint, useModalKeys } from './components/ModalKeys';

export default function App() {
  if (!window.cyberGoAPI) {
    const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    return <div className="empty"><h2>CyberGo</h2><p>{copyOf(lang).desktopOnly}</p></div>;
  }
  if (window.location.hash.startsWith('#/reminders')) return <RemindersWindow />;
  return <MainApp />;
}

/** The recovery notice is built here so the text comes from the dictionary. */
function recoveryText(copy: Copy, notice: RecoveryNotice): string {
  if (notice.kind === 'backup') {
    const text = notice.keptAs
      ? copy.recoveryFromBackupKept
      : copy.recoveryFromBackup;
    return text.replace('{file}', notice.file ?? '').replace('{kept}', notice.keptAs ?? '');
  }
  if (notice.kind === 'set-aside') return copy.recoverySetAside.replace('{file}', notice.file ?? '');
  if (notice.kind === 'empty') return copy.recoveryEmpty;
  return copy.recoveryUnreadable;
}

function MainApp() {
  const api = window.cyberGoAPI;
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Item | null | 'new'>(null);
  const [seed, setSeed] = useState<ItemDraft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>(() => (
    localStorage.getItem('cybergo-view') === 'calendar' ? 'calendar' : 'list'
  ));
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: string; danger?: boolean; run: () => void }>(null);
  /** The menu of the right button, with the items it acts on. */
  const [contextMenu, setContextMenu] = useState<null | { ids: string[]; x: number; y: number }>(null);
  /** The dialog that asks what to do when the window is closed. */
  const [closeDialog, setCloseDialog] = useState(false);
  const [closeRemember, setCloseRemember] = useState(false);
  const lastTheme = useRef<string | null>(null);
  /**
   * Whether a dialog is already open. The command palette is a launcher, so
   * it stays out of the way while another dialog owns the keyboard. Two
   * dialogs at once would fight over the focus and over the Enter key.
   */
  const dialogOpen = useRef(false);
  dialogOpen.current = Boolean(editing) || settingsOpen || aboutOpen || Boolean(confirm);

  /** Runs a promise that nobody waits for, so a failure never becomes an unhandled rejection. */
  function detach(promise: Promise<unknown>, what: string) {
    promise.catch((err) => console.error(`CyberGo could not ${what}`, err));
  }

  async function reload() {
    try {
      const next = await api.getBootstrap();
      setBoot(next);
      setLoadError(null);
      if (lastTheme.current !== next.settings.theme) {
        lastTheme.current = next.settings.theme;
        applyTheme(next.settings.theme);
      }
    } catch (err) {
      console.error('CyberGo could not load the data', err);
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void reload();
    void api.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
    const off = api.onDataChanged(() => void reload());
    const open = api.onOpenItem((id) => {
      setSelectedIds([id]);
      void api.getBootstrap().then((next) => {
        setBoot(next);
        if (lastTheme.current !== next.settings.theme) {
          lastTheme.current = next.settings.theme;
          applyTheme(next.settings.theme);
        }
        const item = next.items.find((row) => row.id === id);
        if (item) setEditing(item);
      }).catch((err) => console.error('CyberGo could not open the item', err));
    });
    const focusQuick = api.onQuickAddFocus(() => {
      window.dispatchEvent(new Event('cybergo:focus-quick'));
    });
    const confirmClose = api.onConfirmFirstClose(() => {
      setCloseRemember(false);
      setCloseDialog(true);
    });
    return () => { off(); open(); focusQuick(); confirmClose(); };
  }, []);

  /** The answer to the question of what to do when the window is closed. */
  function chooseClose(action: 'tray' | 'quit') {
    setCloseDialog(false);
    void api.respondFirstClose(action, closeRemember);
  }

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (dialogOpen.current) return;
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, []);

  function newFromPalette(kind: 'event' | 'task') {
    setSeed({
      kind,
      title: '',
      notes: '',
      allDay: false,
      startLocal: '',
      endLocal: '',
      importance: 'normal',
      color: '',
      groupId,
      recurrence: null,
      remindMinutes: 0,
    });
    setEditing('new');
  }

  function switchView(next: 'list' | 'calendar') {
    setView(next);
    localStorage.setItem('cybergo-view', next);
  }

  function newOnDay(day: Date) {
    const atNine = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0);
    setSeed({
      kind: 'event',
      title: '',
      notes: '',
      allDay: false,
      startLocal: formatLocalInput(atNine, false),
      endLocal: '',
      importance: 'normal',
      color: '',
      groupId,
      recurrence: null,
      remindMinutes: 0,
    });
    setEditing('new');
  }

  const copy = copyOf(boot?.settings.language || 'es');
  const items = boot?.items ?? [];
  const groups = boot?.groups ?? [];
  const filterLabels: Record<FilterId, string> = {
    all: copy.all,
    today: copy.today,
    next7: copy.next7,
    next30: copy.next30,
    upcoming: copy.upcoming,
    overdue: copy.overdue,
    high: copy.high,
    completed: copy.completed,
    trash: copy.trash,
    task: copy.taskFilter,
    event: copy.eventFilter,
  };
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (!matchesFilter(item, filter, groupId)) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q);
    });
    return sortItems(filtered, filter);
  }, [items, filter, groupId, query]);
  /** The column the list is ordered by, and the way it is ordered. */
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const ordered = useMemo(() => (sort ? sortByColumn(visible, sort.column, sort.direction) : visible), [visible, sort]);
  /** Clicking a column orders by it, and clicking it again turns the order around. */
  function orderBy(column: SortColumn) {
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' };
      return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  }
  useEffect(() => {
    setSelectedIds((previous) => {
      const valid = previous.filter((id) => visible.some((item) => item.id === id));
      return valid.length === previous.length ? previous : valid;
    });
  }, [visible]);
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selected = selectedItems[0] ?? null;
  /** True when everything that is on screen is already picked. */
  const allSelected = visible.length > 0 && selectedIds.length === visible.length;
  const stats = useMemo(() => computeStats(items.map((item) => item.completedAt)), [items]);

  useModalKeys(!!confirm || closeDialog, {
    esc: () => {
      if (closeDialog) setCloseDialog(false);
      else setConfirm(null);
    },
    enter: () => {
      if (closeDialog) {
        chooseClose('tray');
        return;
      }
      confirm?.run();
      setConfirm(null);
    },
  });

  /**
   * What the user chose when the window was closed.
   *
   * Enter keeps the app in the tray and Space quits it, the same keys the
   * rest of the suite uses. The space is left out when the focus is on a
   * control, so the checkbox and the buttons keep their own behaviour.
   */
  useEffect(() => {
    if (!closeDialog) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== ' ' && event.code !== 'Space') return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      event.preventDefault();
      chooseClose('quit');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDialog]);

  function askDelete(item: Item) {
    if (item.deletedAt) {
      setConfirm({
        title: copy.confirmPurge,
        body: copy.confirmPurgeBody,
        action: copy.actionConfirm,
        danger: true,
        run: () => detach(api.purgeItem(item.id), 'delete the item permanently'),
      });
      return;
    }
    setConfirm({
      title: copy.confirmDelete,
      body: copy.confirmDeleteBody,
      action: copy.actionConfirm,
      danger: true,
      run: () => detach(api.deleteItem(item.id), 'move the item to the recycle bin'),
    });
  }

  /** The delete of everything that is picked, with a confirmation. */
  function askDeleteSelection() {
    askDeleteItems(selectedItems);
  }

  /** The delete of the given items, with a confirmation. */
  function askDeleteItems(picked: Item[]) {
    if (!picked.length) return;
    const permanent = picked.filter((item) => item.deletedAt);
    const soft = picked.filter((item) => !item.deletedAt);
    setConfirm({
      title: picked.length === 1
        ? (picked[0].deletedAt ? copy.confirmPurge : copy.confirmDelete)
        : copy.confirmDeleteMany.replace('{count}', String(picked.length)),
      body: picked.length === 1
        ? (picked[0].deletedAt ? copy.confirmPurgeBody : copy.confirmDeleteBody)
        : copy.confirmDeleteManyBody.replace('{count}', String(picked.length)),
      action: copy.actionConfirm,
      danger: true,
      run: () => {
        for (const item of permanent) detach(api.purgeItem(item.id), 'delete the item permanently');
        for (const item of soft) detach(api.deleteItem(item.id), 'move the item to the recycle bin');
        setSelectedIds([]);
      },
    });
  }

  /**
   * The menu of the right button.
   *
   * A right click on a row that is not picked picks it. On a row that is
   * already picked, the whole selection is what the menu acts on.
   */
  function showContextMenu(event: ReactMouseEvent<HTMLElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    if (!selectedIds.includes(id)) setSelectedIds([id]);
    const width = 220;
    const height = 160;
    setContextMenu({
      ids,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    });
  }

  /**
   * Whether the given items can be marked as done.
   *
   * Only a task that is still pending can be, and the group is marked only
   * when every one of its items can be.
   */
  function canComplete(ids: string[]): boolean {
    if (!ids.length || filter === 'trash') return false;
    const picked = items.filter((item) => ids.includes(item.id));
    return picked.length > 0 && picked.every((item) => item.kind === 'task' && !item.completedAt);
  }

  function runContextAction(action: 'edit' | 'complete' | 'delete') {    const menu = contextMenu;
    setContextMenu(null);
    if (!menu) return;
    const picked = items.filter((item) => menu.ids.includes(item.id));
    if (!picked.length) return;
    if (action === 'edit') {
      if (picked.length !== 1) return;
      setSelectedIds([picked[0].id]);
      setEditing(picked[0]);
      return;
    }
    if (action === 'complete') {
      for (const item of picked) detach(api.completeItem(item.id), 'complete the item');
      setSelectedIds([]);
      return;
    }
    askDeleteItems(picked);
  }

  // The menu of the right button closes as soon as the pointer goes away.
  useEffect(() => {
    if (!contextMenu) return;
    function away(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('.item-context-menu')) return;
      setContextMenu(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', escape);
    };
  }, [contextMenu]);

  if (!boot) {
    if (loadError) {
      return (
        <div className="fatal">
          <div className="fatal-card">
            <h1>{copy.fatalTitle}</h1>
            <p>{copy.loadFailed}</p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{copy.reload}</button>
          </div>
        </div>
      );
    }
    return <div className="boot" />;
  }
  if (boot.locked) {
    return (
      <>
        <LockScreen copy={copy} hint={boot.settings.passwordHint} method={boot.settings.authMethod} hasPassword={boot.hasPassword} />
        <TextContextMenu copy={copy} />
      </>
    );
  }

  return (
    <>
      <div className="app">
      <TitleBar
        title={<><span>Cyber</span>Go</>}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, restore: copy.restore, close: copy.closeWindow }}
      >
        <div className="toolbar">
          <div className="toolbar-section">
            <button className="btn btn-primary" onClick={() => { setSeed(null); setEditing('new'); }}>
              <Plus size={14} /><span className="toolbar-label">{copy.newItem}</span>
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="selection-actions">
            <Tooltip label={allSelected ? copy.clearSelection : copy.selectAll} placement="bottom">
              <button
                type="button"
                className={`icon-btn ${allSelected ? 'on' : ''}`}
                aria-label={allSelected ? copy.clearSelection : copy.selectAll}
                aria-pressed={allSelected}
                disabled={!visible.length}
                onClick={() => setSelectedIds(allSelected ? [] : visible.map((item) => item.id))}
              >
                {allSelected ? <ListX size={15} /> : <ListChecks size={15} />}
              </button>
            </Tooltip>
            <button className="btn" disabled={selectedItems.length !== 1 || filter === 'trash'} onClick={() => selected && setEditing(selected)}>
              <Pencil size={14} /><span className="toolbar-label">{copy.edit}</span>
            </button>
            <button className="btn" disabled={!selectedItems.length} onClick={() => askDeleteSelection()}>
              <Trash2 size={14} /><span className="toolbar-label">{copy.delete}</span>
            </button>
            <button
              className="btn"
              disabled={!selectedItems.length || selectedItems.some((item) => item.kind !== 'task' || item.completedAt) || filter === 'trash'}
              onClick={() => {
                for (const item of selectedItems) detach(api.completeItem(item.id), 'complete the item');
                setSelectedIds([]);
              }}
            >
              <span className="toolbar-label">{copy.done}</span>
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="toolbar-utility">
            <button className="btn" onClick={() => detach(api.showReminders(), 'show the reminders')}><Bell size={14} /><span className="toolbar-label">{copy.reminders}</span></button>
            <div className="search-wrap">
              <Search size={14} />
              <input className="search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <Tooltip label={copy.clearSearch} placement="bottom">
                  <button type="button" className="search-clear" aria-label={copy.clearSearch} onClick={() => setQuery('')}><X size={13} /></button>
                </Tooltip>
              )}
            </div>
            <Tooltip label={copy.commandShortcut} placement="bottom">
              <button className="icon-btn" aria-label={copy.commandShortcut} onClick={() => setPaletteOpen(true)}><Command size={15} /></button>
            </Tooltip>
            <Tooltip label={copy.lock} placement="bottom">
              <button className="icon-btn" aria-label={copy.lock} onClick={() => detach(api.lock(), 'lock the app')}><Lock size={15} /></button>
            </Tooltip>
            <Tooltip label={copy.settings} placement="bottom">
              <button className="icon-btn" aria-label={copy.settings} onClick={() => setSettingsOpen(true)}><Settings size={15} /></button>
            </Tooltip>
          </div>
        </div>
      </TitleBar>
      <div className="shell">
        <Sidebar
          copy={copy}
          items={items}
          groups={groups}
          filter={filter}
          groupId={groupId}
          onFilter={(next, gid) => { setFilter(gid ? 'all' : next); setGroupId(gid); }}
          onCreateGroup={(name, color) => detach(api.saveGroup({ name, color }), 'save the group')}
          onDeleteGroup={(group) => setConfirm({
            title: copy.confirmGroup,
            body: copy.confirmGroupBody,
            action: copy.actionDeleteGroup,
            danger: true,
            run: () => detach(api.deleteGroup(group.id), 'delete the group'),
          })}
        />
        <section className="list-wrap">
          {boot.recovery && !recoveryDismissed && (
            <div className="data-notice info recovery-notice" role="status" aria-live="polite">
              <span className="data-notice-icon"><Info size={18} /></span>
              <div className="recovery-notice-copy">
                <strong>{copy.dataRecovered}</strong>
                <p>{recoveryText(copy, boot.recovery)}</p>
              </div>
              <button type="button" className="btn recovery-notice-dismiss" aria-label={copy.dismiss} onClick={() => setRecoveryDismissed(true)}>
                <X size={13} />
              </button>
            </div>
          )}
          <div className="workspace-head">
            <div className="workspace-head-copy">
              <p className="workspace-kicker">{copy.workspace}</p>
              <h1 className="workspace-title">{groupId ? groups.find((group) => group.id === groupId)?.name ?? copy.workspace : filterLabels[filter]}</h1>
            </div>
            <span className="seg" role="group" aria-label={`${copy.viewList} / ${copy.viewCalendar}`}>
              <Tooltip label={copy.viewList} placement="bottom">
                <button type="button" aria-label={copy.viewList} className={view === 'list' ? 'on' : ''} onClick={() => switchView('list')}><List size={14} /></button>
              </Tooltip>
              <Tooltip label={copy.viewCalendar} placement="bottom">
                <button type="button" aria-label={copy.viewCalendar} className={view === 'calendar' ? 'on' : ''} onClick={() => switchView('calendar')}><CalendarDays size={14} /></button>
              </Tooltip>
            </span>
          </div>
          {filter !== 'trash' && (
            <QuickAdd
              copy={copy}
              lang={boot.settings.language}
              groupId={groupId}
              onSave={(draft) => api.saveItem(draft).then(() => undefined).catch((err) => {
                console.error('CyberGo could not save the item', err);
                // The rejection has to reach the quick add, otherwise it clears
                // the text as if the item had been created.
                throw err;
              })}
              onMore={(draft) => { setSeed(draft); setEditing('new'); }}
            />
          )}
          {visible.length === 0 ? (
            <div className="empty">
              <h2>{filter === 'trash' ? copy.emptyTrash : copy.emptyTitle}</h2>
              <p>{filter === 'trash' ? '' : copy.emptyBody}</p>
            </div>
          ) : view === 'calendar' && filter !== 'trash' ? (
            <CalendarView
              copy={copy}
              lang={boot.settings.language}
              items={visible}
              groups={groups}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onOpen={(item) => { setSelectedIds([item.id]); setEditing(item); }}
              onNewDay={newOnDay}
              onContextMenu={showContextMenu}
            />
          ) : (
            <ItemTable
              copy={copy}
              lang={boot.settings.language}
              items={ordered}
              groups={groups}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onOpen={(item) => { setSelectedIds([item.id]); if (filter !== 'trash') setEditing(item); }}
              onDelete={askDeleteSelection}
              onContextMenu={showContextMenu}
              sort={sort}
              onSort={orderBy}
            />
          )}
          {filter === 'trash' && items.some((item) => item.deletedAt) && (
            <div className="side-foot" style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={!selected} onClick={() => selected && detach(api.restoreItem(selected.id), 'restore the item')}>{copy.restore}</button>
              <button className="btn btn-danger" onClick={() => setConfirm({
                title: copy.confirmTrash,
                body: copy.confirmTrashBody,
                action: copy.actionEmptyTrash,
                danger: true,
                run: () => detach(api.emptyTrash(), 'empty the recycle bin'),
              })}>{copy.clearTrash}</button>
            </div>
          )}
        </section>
      </div>
      <footer className="statusbar">
        {/* The count already sits under the workspace title, so the status
            bar only carries the streak. */}
        <span className="grow" />
        <Tooltip label={`${stats.doneWeek} ${copy.streakWeek}`} placement="top">
          <span className="streak">
            <Flame size={12} />
            {stats.streak > 0 ? `${copy.streak}: ${stats.streak}` : copy.streakNone}
          </span>
        </Tooltip>
      </footer>
      {editing && (
        <ItemModal
          key={editing === 'new' ? `new-${seed?.title ?? ''}-${seed?.startLocal ?? ''}` : editing.id}
          copy={copy}
          lang={boot.settings.language}
          item={editing === 'new' ? null : editing}
          seed={editing === 'new' ? seed : null}
          groups={groups}
          onClose={() => { setEditing(null); setSeed(null); }}
          onSave={(draft) => api.saveItem(draft).then(() => undefined)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          copy={copy}
          settings={boot.settings}
          hasPassword={boot.hasPassword}
          onClose={() => setSettingsOpen(false)}
          onLock={() => { setSettingsOpen(false); detach(api.lock(), 'lock the app'); }}
          appInfo={appInfo}
          onOpenAbout={() => { setSettingsOpen(false); setAboutOpen(true); }}
        />
      )}
      {aboutOpen && <AboutModal copy={copy} info={appInfo} onClose={() => setAboutOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          copy={copy}
          lang={boot.settings.language}
          items={items}
          onClose={() => setPaletteOpen(false)}
          onOpenItem={(item) => { setSelectedIds([item.id]); setEditing(item); }}
          onNew={newFromPalette}
          onGoFilter={(next) => { setFilter(next); setGroupId(null); }}
          onShowReminders={() => detach(api.showReminders(), 'show the reminders')}
          onLock={() => detach(api.lock(), 'lock the app')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {closeDialog && (
        <DialogPanel className="modal close-window-modal" labelledBy="close-window-title" focusTarget="container" onBackdropMouseDown={() => setCloseDialog(false)}>
          <div className="modal-head">
            <h2 id="close-window-title">{copy.closeWindowTitle}</h2>
            <Tooltip label={copy.close} placement="left">
              <button type="button" className="modal-close" onClick={() => setCloseDialog(false)} aria-label={copy.close}>
                <X size={16} />
              </button>
            </Tooltip>
          </div>
          <div className="modal-body">
            <p className="close-window-text">{copy.closeWindowBody}</p>
            <button type="button" className="close-choice" onClick={() => chooseClose('tray')}>
              <span className="close-choice-icon"><Download size={17} /></span>
              <span className="close-choice-copy">
                <strong>{copy.closeToTray}</strong>
                <span>{copy.closeToTrayHint}</span>
              </span>
              <EnterGlyph />
            </button>
            <button type="button" className="close-choice is-quit" onClick={() => chooseClose('quit')}>
              <span className="close-choice-icon"><Power size={17} /></span>
              <span className="close-choice-copy">
                <strong>{copy.quitApp}</strong>
                <span>{copy.quitAppHint}</span>
              </span>
              <KeyHint label={copy.spaceKey} />
            </button>
            <label className="close-remember">
              <input
                type="checkbox"
                checked={closeRemember}
                onChange={(event) => setCloseRemember(event.target.checked)}
              />
              <span>{copy.rememberCloseChoice}</span>
            </label>
          </div>
        </DialogPanel>
      )}
      {confirm && (
        <DialogPanel className="modal narrow" labelledBy="confirm-title" focusTarget="container" onBackdropMouseDown={() => setConfirm(null)}>
          <h2 id="confirm-title">{confirm.title}</h2>
          <p>{confirm.body}</p>
          <div className="row-actions">
            <button className="btn" onClick={() => setConfirm(null)}>{copy.cancel}<EscHint /></button>
            <button className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { confirm.run(); setConfirm(null); }}>{confirm.action}<EnterGlyph /></button>
          </div>
        </DialogPanel>
      )}
      </div>
      <TextContextMenu copy={copy} />
      {contextMenu && (
        <div
          className="text-context-menu item-context-menu"
          role="menu"
          aria-label={copy.itemContextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {contextMenu.ids.length === 1 && (
            <button type="button" role="menuitem" className="text-context-menu-item" onClick={() => runContextAction('edit')}>
              <Pencil size={15} />
              <span>{copy.edit}</span>
            </button>
          )}
          {canComplete(contextMenu.ids) && (
            <button type="button" role="menuitem" className="text-context-menu-item" onClick={() => runContextAction('complete')}>
              <Check size={15} />
              <span>{contextMenu.ids.length === 1
                ? copy.markDone
                : copy.markDoneMany.replace('{n}', String(contextMenu.ids.length))}</span>
            </button>
          )}
          {contextMenu.ids.length === 1 && canComplete(contextMenu.ids) && (
            <div className="text-context-menu-separator" />
          )}
          <button type="button" role="menuitem" className="text-context-menu-item" onClick={() => runContextAction('delete')}>
            <Trash2 size={15} />
            <span>{contextMenu.ids.length === 1 ? copy.delete : copy.deleteMany.replace('{count}', String(contextMenu.ids.length))}</span>
          </button>
        </div>
      )}
    </>
  );
}
