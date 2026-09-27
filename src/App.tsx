import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Command, List, Lock, Plus, Settings, Trash2 } from 'lucide-react';
import type { Bootstrap, Item, ItemDraft } from '@shared/types';
import { formatLocalInput } from '@shared/schedule';
import { copyOf } from './i18n';
import { matchesFilter, sortItems, type FilterId } from './lib/view';
import { applyTheme } from './themes';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ItemTable from './components/ItemTable';
import CalendarView from './components/CalendarView';
import ItemModal from './components/ItemModal';
import CommandPalette from './components/CommandPalette';
import QuickAdd from './components/QuickAdd';
import SettingsModal from './components/SettingsModal';
import LockScreen from './components/LockScreen';
import RemindersWindow from './components/RemindersWindow';
import { EnterGlyph, EscHint, useModalKeys } from './components/ModalKeys';

export default function App() {
  if (!window.cyberGoAPI) {
    const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
    return <div className="empty"><h2>CyberGo</h2><p>{copyOf(lang).desktopOnly}</p></div>;
  }
  if (window.location.hash.startsWith('#/reminders')) return <RemindersWindow />;
  return <MainApp />;
}

function MainApp() {
  const api = window.cyberGoAPI;
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null | 'new'>(null);
  const [seed, setSeed] = useState<ItemDraft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>(() => (
    localStorage.getItem('cybergo-view') === 'calendar' ? 'calendar' : 'list'
  ));
  const [confirm, setConfirm] = useState<null | { title: string; body: string; danger?: boolean; run: () => void }>(null);

  async function reload() {
    const next = await api.getBootstrap();
    setBoot(next);
    applyTheme(next.settings.theme);
  }

  useEffect(() => {
    void reload();
    const off = api.onDataChanged(() => void reload());
    const open = api.onOpenItem((id) => {
      setSelectedId(id);
      void api.getBootstrap().then((next) => {
        setBoot(next);
        const item = next.items.find((row) => row.id === id);
        if (item) setEditing(item);
      });
    });
    const focusQuick = api.onQuickAddFocus(() => {
      window.dispatchEvent(new Event('cybergo:focus-quick'));
    });
    return () => { off(); open(); focusQuick(); };
  }, []);

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, []);

  function newFromPalette(kind: 'event' | 'task') {    setSeed({
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
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (!matchesFilter(item, filter, groupId)) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q);
    });
    return sortItems(filtered, filter);
  }, [items, filter, groupId, query]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  useModalKeys(!!confirm, {
    esc: () => setConfirm(null),
    enter: () => {
      confirm?.run();
      setConfirm(null);
    },
  });

  function askDelete(item: Item) {
    if (item.deletedAt) {
      setConfirm({ title: copy.confirmPurge, body: copy.confirmPurgeBody, danger: true, run: () => void api.purgeItem(item.id) });
      return;
    }
    setConfirm({ title: copy.confirmDelete, body: copy.confirmDeleteBody, danger: true, run: () => void api.deleteItem(item.id) });
  }

  if (!boot) return <div className="boot" />;
  if (boot.locked) return <LockScreen copy={copy} hint={boot.settings.passwordHint} method={boot.settings.authMethod} />;

  return (
    <div className="app">
      <TitleBar title={<><span>Cyber</span>Go</>}>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => { setSeed(null); setEditing('new'); }}><Plus size={14} />{copy.newItem}</button>
          <button className="btn" disabled={!selected || filter === 'trash'} onClick={() => selected && setEditing(selected)}>{copy.edit}</button>
          <button className="btn" disabled={!selected} onClick={() => selected && askDelete(selected)}><Trash2 size={14} />{copy.delete}</button>
          <button className="btn" disabled={!selected || selected.kind !== 'task' || !!selected.completedAt} onClick={() => selected && void api.completeItem(selected.id)}>{copy.done}</button>
          <button className="btn" onClick={() => void api.showReminders()}><Bell size={14} />{copy.reminders}</button>
          <span className="seg">
            <button type="button" title={copy.viewList} className={view === 'list' ? 'on' : ''} onClick={() => switchView('list')}><List size={14} /></button>
            <button type="button" title={copy.viewCalendar} className={view === 'calendar' ? 'on' : ''} onClick={() => switchView('calendar')}><CalendarDays size={14} /></button>
          </span>
          <input className="search" placeholder={copy.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="icon-btn" title="Ctrl+K" onClick={() => setPaletteOpen(true)}><Command size={15} /></button>
          <button className="icon-btn" title={copy.lock} onClick={() => void api.lock()}><Lock size={15} /></button>
          <button className="icon-btn" title={copy.settings} onClick={() => setSettingsOpen(true)}><Settings size={15} /></button>
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
          onCreateGroup={(name, color) => void api.saveGroup({ name, color })}
          onDeleteGroup={(group) => setConfirm({
            title: copy.confirmGroup,
            body: copy.confirmGroupBody,
            danger: true,
            run: () => void api.deleteGroup(group.id),
          })}
        />
        <section className="list-wrap">
          {filter !== 'trash' && (
            <QuickAdd
              copy={copy}
              lang={boot.settings.language}
              groupId={groupId}
              onSave={(draft) => api.saveItem(draft).then(() => undefined)}
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
              <button className="btn" disabled={!selected} onClick={() => selected && void api.restoreItem(selected.id)}>{copy.restore}</button>
              <button className="btn btn-danger" onClick={() => setConfirm({
                title: copy.confirmTrash,
                body: copy.confirmTrashBody,
                danger: true,
                run: () => void api.emptyTrash(),
              })}>{copy.clearTrash}</button>
            </div>
          )}
        </section>
      </div>
      <footer className="statusbar">{visible.length} {visible.length === 1 ? copy.itemOne : copy.itemMany}</footer>
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
          onLock={() => { setSettingsOpen(false); void api.lock(); }}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          copy={copy}
          lang={boot.settings.language}
          items={items}
          onClose={() => setPaletteOpen(false)}
          onOpenItem={(item) => { setSelectedId(item.id); setEditing(item); }}
          onNew={newFromPalette}
          onGoFilter={(next) => { setFilter(next); setGroupId(null); }}
          onShowReminders={() => void api.showReminders()}
          onLock={() => void api.lock()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {confirm && (
        <div className="backdrop" onMouseDown={() => setConfirm(null)}>
          <div className="modal narrow" onMouseDown={(e) => e.stopPropagation()}>
            <h2>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="row-actions">
              <button className="btn" onClick={() => setConfirm(null)}>{copy.cancel}<EscHint /></button>
              <button className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { confirm.run(); setConfirm(null); }}>{copy.delete}<EnterGlyph /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
