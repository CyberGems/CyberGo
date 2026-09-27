import type { Copy } from '../i18n';
import type { Group, Item } from '@shared/types';
import type { FilterId } from '../lib/view';
import { matchesFilter } from '../lib/view';
import { SWATCHES } from '@shared/types';
import { useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, Clock3, Flag, FolderPlus, Inbox, ListFilter, Plus, Trash2 } from 'lucide-react';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

const FILTERS: Exclude<FilterId, 'trash'>[] = ['all', 'today', 'next7', 'next30', 'upcoming', 'overdue', 'high', 'completed'];
const FILTER_ICONS = {
  all: Inbox,
  today: CalendarDays,
  next7: CalendarRange,
  next30: CalendarRange,
  upcoming: Clock3,
  overdue: AlertTriangle,
  high: Flag,
  completed: CheckCircle2,
} as const;

export default function Sidebar({
  copy,
  items,
  groups,
  filter,
  groupId,
  onFilter,
  onCreateGroup,
  onDeleteGroup,
}: {
  copy: Copy;
  items: Item[];
  groups: Group[];
  filter: FilterId;
  groupId: string | null;
  onFilter: (filter: FilterId, groupId: string | null) => void;
  onCreateGroup: (name: string, color: string) => void;
  onDeleteGroup: (group: Group) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  useModalKeys(adding, {
    esc: () => setAdding(false),
    enter: () => {
      if (!name.trim()) return;
      onCreateGroup(name.trim(), color);
      setName('');
      setAdding(false);
    },
  });
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
  const count = (id: FilterId, gid: string | null = null) => items.filter((item) => matchesFilter(item, id, gid)).length;

  return (
    <aside className="sidebar">
      <div className="side-scroll">
        <div className="side-label"><ListFilter size={12} />{copy.filters}</div>
        {FILTERS.map((id) => (
          <button key={id} className={`nav-btn ${filter === id && !groupId ? 'active' : ''}`} onClick={() => onFilter(id, null)} aria-current={filter === id && !groupId ? 'page' : undefined}>
            {(() => { const Icon = FILTER_ICONS[id]; return <Icon size={15} />; })()}
            {labels[id]}
            <span className="badge">{count(id)}</span>
          </button>
        ))}
        <div className="side-label"><FolderPlus size={12} />{copy.groups}</div>
        {groups.length === 0 && !adding && <div className="hint" style={{ padding: '0 8px' }}>{copy.noGroups}</div>}
        {groups.map((group) => (
          <div key={group.id} className={`group-row ${groupId === group.id ? 'active' : ''}`}>
            <button type="button" className="group-main" onClick={() => onFilter('all', group.id)} aria-current={groupId === group.id ? 'page' : undefined}>
              <i className="dot" style={{ background: group.color }} />
              <span className="subject">{group.name}</span>
              <span className="badge">{count('all', group.id)}</span>
            </button>
            <button type="button" className="icon-btn" onClick={() => onDeleteGroup(group)} aria-label={`${copy.delete}: ${group.name}`} title={copy.delete}><Trash2 size={13} /></button>
          </div>
        ))}
        {adding ? (
          <form className="field" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onCreateGroup(name.trim(), color); setName(''); setAdding(false); }}>
            <input className="inline-input" autoFocus placeholder={copy.groupName} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="swatches">
              {SWATCHES.map((swatch) => (
                <button type="button" key={swatch} className={`swatch ${color === swatch ? 'on' : ''}`} style={{ background: swatch }} onClick={() => setColor(swatch)} aria-label={swatch} aria-pressed={color === swatch} />
              ))}
            </div>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setAdding(false)}>{copy.cancel}<EscHint /></button>
              <button className="btn btn-primary" type="submit" disabled={!name.trim()}>{copy.save}<EnterGlyph /></button>
            </div>
          </form>
        ) : (
          <button className="nav-btn" onClick={() => setAdding(true)}><Plus size={15} />{copy.newGroup}</button>
        )}
      </div>
      <div className="side-foot">
        <button className={`nav-btn ${filter === 'trash' ? 'active' : ''}`} onClick={() => onFilter('trash', null)} aria-current={filter === 'trash' ? 'page' : undefined}>
          <Trash2 size={15} />
          {copy.trash}
          <span className="badge">{count('trash')}</span>
        </button>
      </div>
    </aside>
  );
}
