import { useState } from 'react';
import { SWATCHES, type Group, type Item, type ItemDraft, type Lang } from '@shared/types';
import { X } from 'lucide-react';
import { parseLocal, toDateInput, toDateTimeInput } from '@shared/schedule';
import type { Copy } from '../i18n';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';
import DateTimeField from './DateTimeField';
import DialogPanel from './Dialog';
import Tooltip from './Tooltip';

/** Name of every colour offered by the swatch row, keyed by its hex value. */
const SWATCH_NAMES: Record<string, keyof Copy['swatch']> = {
  '#6c63e6': 'violet',
  '#06b6d4': 'cyan',
  '#10b981': 'green',
  '#f59e0b': 'amber',
  '#ef4444': 'red',
  '#ec4899': 'pink',
  '#3b82f6': 'blue',
  '#d946ef': 'magenta',
};

function swatchLabel(copy: Copy, hex: string) {
  const name = SWATCH_NAMES[hex];
  return copy.colorName.replace('{name}', name ? copy.swatch[name] : hex);
}

function fromItem(item: Item): ItemDraft {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    notes: item.notes,
    allDay: item.allDay,
    startLocal: item.allDay ? toDateInput(item.startAt) : toDateTimeInput(item.startAt),
    endLocal: item.allDay ? toDateInput(item.endAt) : toDateTimeInput(item.endAt),
    importance: item.importance,
    color: item.color,
    groupId: item.groupId,
    recurrence: item.recurrence,
    remindMinutes: item.remindMinutes,
  };
}

const blank = (): ItemDraft => ({
  kind: 'event',
  title: '',
  notes: '',
  allDay: false,
  startLocal: '',
  endLocal: '',
  importance: 'normal',
  color: '',
  groupId: null,
  recurrence: null,
  remindMinutes: 0,
});

/**
 * A monthly series keeps the calendar day of its first occurrence. Without
 * that anchor a January 31 event would settle on the 28th of February and
 * stay there for good.
 */
function monthlyAnchor(draft: ItemDraft): ItemDraft['recurrence'] {
  const day = Number(draft.startLocal?.slice(8, 10) ?? 0);
  return {
    freq: 'monthly',
    interval: 1,
    until: null,
    dayOfMonth: day >= 1 && day <= 31 ? day : null,
  };
}

/**
 * Moving the start date moves the anchor with it. A series left on the old
 * day would jump to a date the user is not looking at.
 */
function withStartDate(draft: ItemDraft, startLocal: string): ItemDraft {
  const recurrence = draft.recurrence;
  if (!recurrence || (recurrence.freq !== 'monthly' && recurrence.freq !== 'yearly')) {
    return { ...draft, startLocal };
  }
  const day = Number(startLocal.slice(8, 10));
  return {
    ...draft,
    startLocal,
    recurrence: { ...recurrence, dayOfMonth: day >= 1 && day <= 31 ? day : null },
  };
}

export default function ItemModal({
  copy,
  lang,
  item,
  seed,
  groups,
  onClose,
  onSave,
}: {
  copy: Copy;
  lang: Lang;
  item: Item | null;
  seed?: ItemDraft | null;
  groups: Group[];
  onClose: () => void;
  onSave: (draft: ItemDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ItemDraft>(item ? fromItem(item) : seed ?? blank());
  const [error, setError] = useState('');
  const presets = [0, 15, 60, 1440];
  const custom = !presets.includes(draft.remindMinutes);
  const set = (patch: Partial<ItemDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  function toggleAllDay(next: boolean) {
    setDraft((prev) => {
      const convert = (value: string): string => {
        if (!value) return value;
        if (next) return value.slice(0, 10);
        return value.length <= 10 ? `${value}T09:00` : value;
      };
      return {
        ...prev,
        allDay: next,
        startLocal: convert(prev.startLocal || ''),
        endLocal: convert(prev.endLocal || ''),
      };
    });
  }

  let endInvalid = false;
  if (draft.startLocal && draft.endLocal) {
    try {
      endInvalid = parseLocal(draft.endLocal, draft.allDay).getTime() < parseLocal(draft.startLocal, draft.allDay).getTime();
    } catch {
      endInvalid = true;
    }
  }
  const canSave = draft.title.trim().length > 0 && (draft.kind === 'task' || Boolean(draft.startLocal)) && !endInvalid;

  async function save() {
    if (!canSave) return;
    try {
      await onSave({
        ...draft,
        title: draft.title.trim(),
        startLocal: draft.startLocal || null,
        endLocal: draft.endLocal || null,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('date')) setError(copy.needDate);
      else if (message.includes('title')) setError(copy.needTitle);
      else setError(copy.badEnd);
    }
  }

  useModalKeys(true, { esc: onClose, enter: canSave ? () => void save() : undefined });

  return (
    <DialogPanel className="modal item-modal" labelledBy="item-modal-title" onBackdropMouseDown={onClose}>
      <div className="modal-head">
        <h2 id="item-modal-title">{item ? copy.edit : copy.newItem}</h2>
        <Tooltip label={copy.close} placement="left">
          <button type="button" className="modal-close" onClick={onClose} aria-label={copy.close}>
            <X size={16} />
          </button>
        </Tooltip>
      </div>
      <div className="modal-body">
      <div className="field">
        <span>{copy.kind}</span>
        <div className="seg">
          <button type="button" className={draft.kind === 'event' ? 'on' : ''} onClick={() => set({ kind: 'event' })}>{copy.event}</button>
          <button type="button" className={draft.kind === 'task' ? 'on' : ''} onClick={() => set({ kind: 'task' })}>{copy.task}</button>
        </div>
      </div>
      <label className="field"><span>{copy.title}</span><input data-focus value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus /></label>
      <label className="field"><span>{copy.notes}</span><textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
      <label className="check">
        <input type="checkbox" checked={draft.allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
        {copy.allDay}
      </label>
      <div className="grid-2">
        <label className="field">
          <span>{draft.kind === 'task' ? copy.due : copy.start} <em>{copy.optional}</em></span>
          <DateTimeField lang={lang} copy={copy} allDay={draft.allDay} value={draft.startLocal || ''} onChange={(startLocal) => setDraft((prev) => withStartDate(prev, startLocal))} />
        </label>
        <label className="field">
          <span>{copy.end} <em>{copy.optional}</em></span>
          <DateTimeField lang={lang} copy={copy} allDay={draft.allDay} value={draft.endLocal || ''} onChange={(endLocal) => set({ endLocal })} />
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span>{copy.importance}</span>
          <select value={draft.importance} onChange={(e) => set({ importance: e.target.value as ItemDraft['importance'] })}>
            <option value="low">{copy.low}</option>
            <option value="normal">{copy.normal}</option>
            <option value="high">{copy.highImp}</option>
          </select>
        </label>
        <label className="field">
          <span>{copy.group}</span>
          <select value={draft.groupId || ''} onChange={(e) => set({ groupId: e.target.value || null })}>
            <option value="">{copy.noGroup}</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
      </div>
      <div className="field">
        <span>{copy.color}</span>
        <div className="swatches">
          <Tooltip label={copy.none} placement="top">
            <button type="button" aria-label={copy.none} className={`swatch ${draft.color === '' ? 'on' : ''}`} onClick={() => set({ color: '' })} />
          </Tooltip>
          {SWATCHES.map((swatch) => (
            <button
              type="button"
              key={swatch}
              aria-label={swatchLabel(copy, swatch)}
              aria-pressed={draft.color === swatch}
              className={`swatch ${draft.color === swatch ? 'on' : ''}`}
              style={{ background: swatch }}
              onClick={() => set({ color: swatch })}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <span>{copy.remind}</span>
        <select
          value={custom ? 'custom' : String(draft.remindMinutes)}
          onChange={(e) => {
            if (e.target.value === 'custom') set({ remindMinutes: 5 });
            else set({ remindMinutes: Number(e.target.value) });
          }}
        >
          <option value="0">{copy.atTime}</option>
          <option value="15">{copy.before15}</option>
          <option value="60">{copy.before60}</option>
          <option value="1440">{copy.beforeDay}</option>
          <option value="custom">{copy.custom}</option>
        </select>
        {custom && (
          <input type="number" min={0} value={draft.remindMinutes} onChange={(e) => set({ remindMinutes: Number(e.target.value) })} />
        )}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={!!draft.recurrence}
          onChange={(e) => set({ recurrence: e.target.checked ? monthlyAnchor(draft) : null })}
        />
        {copy.repeat}
      </label>
      {draft.recurrence && (
        <div className="grid-2">
          <label className="field">
            <span>{copy.every}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" min={1} value={draft.recurrence.interval} onChange={(e) => set({ recurrence: { ...draft.recurrence!, interval: Number(e.target.value) || 1 } })} />
              <select value={draft.recurrence.freq} onChange={(e) => {
                const freq = e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly';
                const anchor = freq === 'monthly' && draft.recurrence?.dayOfMonth == null
                  ? monthlyAnchor(draft)?.dayOfMonth ?? null
                  : draft.recurrence!.dayOfMonth ?? null;
                set({ recurrence: { ...draft.recurrence!, freq, dayOfMonth: anchor } });
              }}>
                <option value="daily">{copy.daily}</option>
                <option value="weekly">{copy.weekly}</option>
                <option value="monthly">{copy.monthly}</option>
                <option value="yearly">{copy.yearly}</option>
              </select>
            </div>
          </label>
          <label className="field">
            <span>{copy.until} ({copy.optional})</span>
            <input type="date" value={draft.recurrence.until || ''} onChange={(e) => set({ recurrence: { ...draft.recurrence!, until: e.target.value || null } })} />
          </label>
        </div>
      )}
      <div className="error">{endInvalid ? copy.badEnd : error}</div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{copy.cancel}<EscHint /></button>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>{copy.save}<EnterGlyph /></button>
      </div>
    </DialogPanel>
  );
}
