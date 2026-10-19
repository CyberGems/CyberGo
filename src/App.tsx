import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Command, Flame, Info, List, Lock, Pencil, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import type { AppInfo, Bootstrap, Item, ItemDraft, RecoveryNotice } from '@shared/types';
import { formatLocalInput } from '@shared/schedule';
import { copyOf, type Copy } from './i18n';
import { matchesFilter, sortItems, type FilterId } from './lib/view';
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
import { EnterGlyph, EscHint, useModalKeys } from './components/ModalKeys';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      setSelectedId(id);
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
    return () => { off(); open(); focusQuick(); };
  }, []);

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
  useEffect(() => {
    if (selectedId && !visible.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [selectedId, visible]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const stats = useMemo(() => computeStats(items.map((item) => item.completedAt)), [items]);

  useModalKeys(!!confirm, {
    esc: () => setConfirm(null),
    enter: () => {
      confirm?.run();
      setConfirm(null);
    },
  });

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
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      >
        <div className="toolbar">
          <div className="toolbar-section">
            <button className="btn btn-primary" onClick={() => { setSeed(null); setEditing('new'); }}>
              <Plus size={14} /><span className="toolbar-label">{copy.newItem}</span>
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="selection-actions">
            <button className="btn" disabled={!selected || filter === 'trash'} onClick={() => selected && setEditing(selected)}>
              <Pencil size={14} /><span className="toolbar-label">{copy.edit}</span>
            </button>
            <button className="btn" disabled={!selected} onClick={() => selected && askDelete(selected)}>
              <Trash2 size={14} /><span className="toolbar-label">{copy.delete}</span>
            </button>
            <button className="btn" disabled={!selected || selected.kind !== 'task' || !!selected.completedAt || filter === 'trash'} onClick={() => selected && detach(api.completeItem(selected.id), 'complete the item')}>
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
              <p className="workspace-meta">{visible.length} {visible.length === 1 ? copy.itemOne : copy.itemMany}</p>
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
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={(item) => { setSelectedId(item.id); setEditing(item); }}
              onNewDay={newOnDay}
            />
          ) : (
            <ItemTable
              copy={copy}
              lang={boot.settings.language}
              items={visible}
              groups={groups}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={(item) => { setSelectedId(item.id); if (filter !== 'trash') setEditing(item); }}
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
        <span>{visible.length} {visible.length === 1 ? copy.itemOne : copy.itemMany}</span>
        {loadError && <span className="status-error" role="alert">{copy.loadFailed}</span>}
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
          onOpenItem={(item) => { setSelectedId(item.id); setEditing(item); }}
          onNew={newFromPalette}
          onGoFilter={(next) => { setFilter(next); setGroupId(null); }}
          onShowReminders={() => detach(api.showReminders(), 'show the reminders')}
          onLock={() => detach(api.lock(), 'lock the app')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
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
    </>
  );
}
