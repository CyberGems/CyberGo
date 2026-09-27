import { Flag } from 'lucide-react';
import type { Copy } from '../i18n';
import type { Group, Item, Lang } from '@shared/types';
import { daysLeft, formatDate, formatTimeRange } from '../lib/format';

function safeTint(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '';
}

export default function ItemTable({
  copy,
  lang,
  items,
  groups,
  selectedId,
  onSelect,
  onOpen,
}: {
  copy: Copy;
  lang: Lang;
  items: Item[];
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (item: Item) => void;
}) {
  if (!items.length) return null;
  return (
    <>
      <div className="list-head">
        <span />
        <span>{copy.colWhen}</span>
        <span>{copy.colTime}</span>
        <span>{copy.colLeft}</span>
        <span>{copy.colSubject}</span>
        <span />
      </div>
      <div className="rows">
        {items.map((item) => {
          const group = groups.find((g) => g.id === item.groupId);
          const tint = safeTint(item.color || group?.color || '');
          return (
            <div
              key={item.id}
              className={`row ${selectedId === item.id ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onOpen(item)}
              style={tint && selectedId !== item.id ? { background: `color-mix(in srgb, ${tint} 12%, transparent)` } : undefined}
            >
              <i className="dot" style={{ background: tint || 'transparent', border: tint ? 'none' : '1px solid var(--border)' }} />
              <span>{formatDate(item.occurrenceAt || item.startAt, lang)}</span>
              <span className="muted">{formatTimeRange(item, lang, copy)}</span>
              <span>{daysLeft(item, copy)}</span>
              <span className="subject">{item.importance === 'high' && <Flag className="flag" size={12} style={{ marginRight: 6 }} />}{item.title}</span>
              <span className="kind-tag">{item.kind === 'task' ? copy.task : copy.event}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
