import { useEffect, useRef, useState } from 'react';
import type { ItemDraft, Lang } from '@shared/types';
import { formatLocalInput, parseLocal } from '@shared/schedule';
import { parseQuick, presetStart, type QuickPreset } from '@shared/quick';
import type { Copy } from '../i18n';
import { duePhrase, formatClock } from '../lib/format';
import { EnterGlyph } from './ModalKeys';
import Tooltip from './Tooltip';
import { ChevronDown, ChevronUp, SlidersHorizontal, Sparkles } from 'lucide-react';

const PRESETS: QuickPreset[] = ['10m', '1h', 'tonight', 'tomorrow9'];

function draftFrom(text: string, armed: QuickPreset | null, groupId: string | null, force: Date | null): ItemDraft {
  const parsed = parseQuick(text);
  const presetTime = force ?? (armed ? presetStart(armed) : null);
  const start = presetTime ?? parsed.start;
  const allDay = !presetTime && parsed.allDay;
  return {
    kind: 'task',
    title: parsed.title,
    notes: '',
    allDay,
    startLocal: start ? formatLocalInput(start, allDay) : null,
    endLocal: null,
    importance: parsed.importance,
    color: '',
    groupId,
    recurrence: parsed.recurrence,
    remindMinutes: 0,
  };
}

function recurrenceSummary(copy: Copy, recurrence: NonNullable<ReturnType<typeof parseQuick>['recurrence']>) {
  if (recurrence.dayOfMonth) return `${copy.repeat}: ${copy.recurOnDay} ${recurrence.dayOfMonth}`;
  const unit = recurrence.freq === 'daily'
    ? copy.daily
    : recurrence.freq === 'weekly'
      ? copy.weekly
      : recurrence.freq === 'monthly'
        ? copy.monthly
        : copy.yearly;
  const cadence = recurrence.interval === 1 ? unit : `${recurrence.interval} ${unit}`;
  return `${copy.repeat}: ${copy.recurEvery} ${cadence}`;
}

export default function QuickAdd({
  copy,
  lang,
  groupId,
  onSave,
  onMore,
}: {
  copy: Copy;
  lang: Lang;
  groupId: string | null;
  onSave: (draft: ItemDraft) => Promise<void>;
  onMore: (draft: ItemDraft) => void;
}) {
  const [text, setText] = useState('');
  const [example, setExample] = useState(0);
  const [exampleOn, setExampleOn] = useState(true);
  const [armed, setArmed] = useState<QuickPreset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cybergo-quick-collapsed') === '1');
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseQuick(text);
  const previewDraft = draftFrom(text, armed, groupId, null);
  const start = previewDraft.startLocal ? parseLocal(previewDraft.startLocal, previewDraft.allDay) : null;
  const canSave = parsed.title.length > 0 && !busy;
  const examples = copy.quickExamples;

  useEffect(() => {
    localStorage.setItem('cybergo-quick-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const focus = () => {
      setCollapsed(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('cybergo:focus-quick', focus);
    return () => window.removeEventListener('cybergo:focus-quick', focus);
  }, []);

  useEffect(() => {
    if (text.trim()) return;
    let fade = 0;
    const tick = window.setInterval(() => {
      window.clearTimeout(fade);
      setExampleOn(false);
      fade = window.setTimeout(() => {
        setExample((index) => (index + 1) % examples.length);
        setExampleOn(true);
      }, 280);
    }, 3400);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(fade);
    };
  }, [text, examples]);

  const preview = [
    copy.task,
    parsed.title || '…',
    start ? duePhrase(start.toISOString(), copy) : copy.quickNone,
    start && !previewDraft.allDay ? formatClock(start.toISOString(), lang) : '',
    parsed.importance === 'high' ? copy.highImp : '',
    parsed.recurrence ? recurrenceSummary(copy, parsed.recurrence) : '',
  ].filter(Boolean).join(' · ');

  async function commit(force: Date | null) {
    const draft = draftFrom(text, armed, groupId, force);
    if (!draft.title || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(draft);
      setText('');
      setArmed(null);
    } catch {
      // The text stays where it is. Clearing it would throw away what the
      // user wrote because the save did not go through.
      setError(copy.saveFailed);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function usePreset(preset: QuickPreset) {
    if (!text.trim()) return;
    setArmed((current) => (current === preset ? null : preset));
    inputRef.current?.focus();
  }

  return (
    <div className={`quick ${collapsed ? 'collapsed' : ''}`}>
      <div className="quick-heading">
        <button
          type="button"
          className="quick-heading-toggle"
          aria-expanded={!collapsed}
          aria-controls="quick-add-content"
          onClick={() => setCollapsed((current) => !current)}
        >
          <span className="quick-title-mark"><Sparkles size={15} /></span>
          <span className="quick-title-copy">
            <strong>{copy.quickAddLabel}</strong>
            <span id="quick-add-hint">{copy.quickHint}</span>
          </span>
        </button>
        <div className="quick-heading-actions">
          <kbd className="quick-shortcut">{copy.quickShortcut}</kbd>
          <Tooltip label={collapsed ? copy.quickExpand : copy.quickCollapse} placement="top">
            <button
              type="button"
              className="icon-btn quick-collapse"
              aria-label={collapsed ? copy.quickExpand : copy.quickCollapse}
              aria-expanded={!collapsed}
              aria-controls="quick-add-content"
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </Tooltip>
        </div>
      </div>
      {!collapsed && (
        <div className="quick-content" id="quick-add-content">
          <div className="quick-row">
            <div className="quick-field">
              <input
                ref={inputRef}
                value={text}
                aria-label={copy.quickAddLabel}
                aria-describedby="quick-add-hint"
                placeholder=""
                onChange={(event) => {
                  const next = event.target.value;
                  setText(next);
                  if (!next.trim() || parseQuick(next).start) setArmed(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    void commit(null);
                  }
                }}
              />
              {!text && <span className={`quick-ghost ${exampleOn ? 'show' : ''}`} aria-hidden="true">{examples[example]}</span>}
            </div>
            <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void commit(null)}>
              {copy.create}<EnterGlyph />
            </button>
            <button type="button" className="btn" onClick={() => onMore(draftFrom(text, armed, groupId, null))}><SlidersHorizontal size={14} />{copy.more}</button>
          </div>
          <div className="quick-presets">
            <span className={`quick-when ${text.trim() ? 'on' : ''}`}>{copy.quickWhen}</span>
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={`chip ${armed === preset ? 'on' : ''}`}
                disabled={!text.trim()}
                onClick={() => usePreset(preset)}
              >
                {preset === '10m' ? copy.preset10 : preset === '1h' ? copy.preset1h : preset === 'tonight' ? copy.presetTonight : copy.presetTomorrow9}
              </button>
            ))}
          </div>
          <div className={`quick-preview ${text.trim() || armed ? '' : 'muted'}`}>
            <Sparkles size={13} />
            {text.trim() || armed ? preview : copy.quickHint}
          </div>
          {error && <div className="quick-error" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}
