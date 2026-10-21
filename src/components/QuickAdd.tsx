import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ItemDraft, Lang } from '@shared/types';
import { formatLocalInput, parseLocal } from '@shared/schedule';
import { parseQuick, presetStart, type QuickPreset } from '@shared/quick';
import type { Copy } from '../i18n';
import { duePhrase, formatClock } from '../lib/format';
import { EnterGlyph } from './ModalKeys';
import Tooltip from './Tooltip';
import { CalendarDays, ChevronDown, ChevronUp, SlidersHorizontal, Sparkles } from 'lucide-react';

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
  /** The menu of the button that offers the rest of the options. */
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreBox, setMoreBox] = useState<{ left: number; top: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
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

  async function commit(force: Date | null, kind: ItemDraft['kind'] = 'task') {
    const draft = { ...draftFrom(text, armed, groupId, force), kind };
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

  /**
   * The menu of the button that offers the rest of the options.
   *
   * The capture creates a task and nothing else. The menu is where the other
   * two ways of creating it live: the full editor, and an event.
   */
  function openMore() {
    const rect = moreRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 220;
    setMoreBox({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 100)),
    });
    setMoreOpen(true);
  }

  useEffect(() => {
    if (!moreOpen) return;
    function away(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('.quick-more-menu') || target.closest('.quick-more-button')) return;
      setMoreOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', escape);
    };
  }, [moreOpen]);

  return (
    <div className={`quick ${collapsed ? 'collapsed' : ''}`}>
      {collapsed ? (
        <div className="quick-heading">
          <button
            type="button"
            className="quick-heading-toggle"
            aria-expanded={false}
            aria-controls="quick-add-content"
            onClick={() => setCollapsed(false)}
          >
            <span className="quick-title-mark"><Sparkles size={15} /></span>
            <span className="quick-title-copy">
              <strong>{copy.quickAddLabel}</strong>
            </span>
          </button>
          <div className="quick-heading-actions">
            <Tooltip label={copy.quickExpand} placement="top">
              <button
                type="button"
                className="icon-btn quick-collapse"
                aria-label={copy.quickExpand}
                aria-expanded={false}
                aria-controls="quick-add-content"
                onClick={() => setCollapsed(false)}
              >
                <ChevronDown size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="quick-content" id="quick-add-content">
          <span id="quick-add-hint" className="visually-hidden">{copy.quickHint}</span>
          <div className="quick-row">
            <Tooltip label={copy.quickHint} placement="bottom">
              <span className="quick-title-mark" aria-hidden="true"><Sparkles size={15} /></span>
            </Tooltip>
            <span className="quick-title-label">{copy.quickAddLabel}</span>
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
            <button
              type="button"
              className="btn quick-more-button"
              ref={moreRef}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => (moreOpen ? setMoreOpen(false) : openMore())}
            >
              <SlidersHorizontal size={14} />{copy.more}
            </button>
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
            <span className="grow" />
            <kbd className="quick-shortcut">{copy.quickShortcut}</kbd>
            <Tooltip label={copy.quickCollapse} placement="top">
              <button
                type="button"
                className="icon-btn quick-collapse"
                aria-label={copy.quickCollapse}
                aria-expanded
                aria-controls="quick-add-content"
                onClick={() => setCollapsed(true)}
              >
                <ChevronUp size={16} />
              </button>
            </Tooltip>
          </div>
          {/* The hint already sits in the heading, so this line only shows
              what the phrase is going to become. It is not drawn when there
              is nothing to say, so the card keeps no empty room. */}
          {(text.trim() || armed) && (
            <div className="quick-preview">
              <Sparkles size={13} />
              {preview}
            </div>
          )}
          {error && <div className="quick-error" role="alert">{error}</div>}
        </div>
      )}
      {moreOpen && moreBox && createPortal(
        <div
          className="text-context-menu quick-more-menu"
          role="menu"
          aria-label={copy.more}
          style={{ left: moreBox.left, top: moreBox.top }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            className="text-context-menu-item"
            disabled={!parsed.title}
            onClick={() => { setMoreOpen(false); onMore(draftFrom(text, armed, groupId, null)); }}
          >
            <SlidersHorizontal size={15} />
            <span>{copy.quickOpenEditor}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="text-context-menu-item"
            disabled={!parsed.title}
            onClick={() => { setMoreOpen(false); void commit(null, 'event'); }}
          >
            <CalendarDays size={15} />
            <span>{copy.quickAsEvent}</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
