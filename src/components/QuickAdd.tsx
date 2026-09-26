import { useEffect, useRef, useState } from 'react';
import type { ItemDraft, Lang } from '@shared/types';
import { formatLocalInput, parseLocal } from '@shared/schedule';
import { parseQuick, presetStart, type QuickPreset } from '@shared/quick';
import type { Copy } from '../i18n';
import { duePhrase, formatClock } from '../lib/format';
import { EnterGlyph } from './ModalKeys';

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
    recurrence: null,
    remindMinutes: 0,
  };
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
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseQuick(text);
  const previewDraft = draftFrom(text, armed, groupId, null);
  const start = previewDraft.startLocal ? parseLocal(previewDraft.startLocal, previewDraft.allDay) : null;
  const canSave = parsed.title.length > 0 && !busy;
  const examples = copy.quickExamples;

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
    start ? duePhrase(start.toISOString(), lang) : copy.quickNone,
    start && !previewDraft.allDay ? formatClock(start.toISOString(), lang) : '',
    parsed.importance === 'high' ? copy.highImp : '',
  ].filter(Boolean).join(' · ');

  async function commit(force: Date | null) {
    const draft = draftFrom(text, armed, groupId, force);
    if (!draft.title || busy) return;
    setBusy(true);
    try {
      await onSave(draft);
      setText('');
      setArmed(null);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function usePreset(preset: QuickPreset) {
    setArmed((current) => (current === preset ? null : preset));
    inputRef.current?.focus();
  }

  return (
    <div className="quick">
      <div className="quick-row">
        <div className="quick-field">
        <input
          ref={inputRef}
          value={text}
          aria-label={copy.quickHint}
          placeholder=""
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (parseQuick(next).start) setArmed(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              void commit(null);
            }
          }}
        />
        {!text && <span className={`quick-ghost ${exampleOn ? 'show' : ''}`}>{examples[example]}</span>}
        </div>
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void commit(null)}>
          {copy.create}<EnterGlyph />
        </button>
        <button type="button" className="btn" onClick={() => onMore(draftFrom(text, armed, groupId, null))}>{copy.more}</button>
      </div>
      <div className="quick-presets">
        <span className="quick-when">{copy.quickWhen}</span>
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            className={`chip ${armed === preset ? 'on' : ''}`}
            onClick={() => usePreset(preset)}
          >
            {preset === '10m' ? copy.preset10 : preset === '1h' ? copy.preset1h : preset === 'tonight' ? copy.presetTonight : copy.presetTomorrow9}
          </button>
        ))}
      </div>
      <div className={`quick-preview ${text.trim() || armed ? '' : 'muted'}`}>
        {text.trim() || armed ? preview : copy.quickHint}
      </div>
    </div>
  );
}
