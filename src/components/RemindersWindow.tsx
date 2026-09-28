import { useEffect, useState } from 'react';
import type { Item, PublicSettings } from '@shared/types';
import { copyOf } from '../i18n';
import { duePhrase } from '../lib/format';
import { playAlert, stopAlert } from '../lib/sound';
import { applyTheme } from '../themes';
import TitleBar from './TitleBar';
import TextContextMenu from './TextContextMenu';
import { BellRing, CheckCircle2, ChevronRight, Clock3, ExternalLink, Timer, VolumeX, X, XCircle } from 'lucide-react';

export default function RemindersWindow() {
  const api = window.cyberGoAPI;
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [amount, setAmount] = useState(8);
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const copy = copyOf(settings?.language || 'es');

  async function reload(pulseIds: string[] = []) {
    setPreviewMode(false);
    const [due, boot] = await Promise.all([api.dueReminders(), api.getBootstrap()]);
    setItems(due);
    if (!due.length) stopAlert();
    setSettings(boot.settings);
    applyTheme(boot.settings.theme);
    setSelected((prev) => (prev && due.some((item) => item.id === prev) ? prev : due[0]?.id ?? null));
    if (pulseIds.length) {
      setPulse(pulseIds);
      setSelected(pulseIds[0]);
      window.setTimeout(() => setPulse([]), 1600);
    }
  }

  useEffect(() => {
    const offData = api.onDataChanged(() => void reload());
    const off = api.onReminderUpdate((payload) => {
      void reload(payload.pulseIds);
      if (payload.sound) void playAlert();
    });
    const offPreview = api.onReminderPreview((payload) => {
      setItems(payload.items);
      setSettings(payload.settings);
      setPreviewMode(true);
      setSelected(payload.items[0]?.id ?? null);
      setPulse([]);
      stopAlert();
      applyTheme(payload.settings.theme);
    });
    void reload();
    return () => { offData(); off(); offPreview(); };
  }, []);

  const current = items.find((item) => item.id === selected) ?? null;
  const minutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);

  return (
    <div className="reminder-app">
      <TitleBar
        title={copy.remindersTitle}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      />
      <div className="reminder-body">
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
            <div className="reminder-list" aria-label={copy.remindersTitle}>
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`reminder-row ${selected === item.id ? 'selected' : ''} ${pulse.includes(item.id) ? 'pulse' : ''}`}
                  onClick={() => setSelected(item.id)}
                  aria-pressed={selected === item.id}
                >
                  <span className="reminder-row-icon"><BellRing size={14} /></span>
                  <span className="reminder-row-content">
                    <span className="reminder-row-top"><strong className="subject">{item.title}</strong></span>
                    <span className="reminder-row-due">{duePhrase(item.occurrenceAt || item.nextFireAt, settings?.language || 'es')}</span>
                  </span>
                  <ChevronRight className="reminder-row-chevron" size={15} />
                </button>
              ))}
            </div>
            <div className="reminder-selection">
              <p className="reminder-selection-kicker">{copy.selectedReminder}</p>
              <h2 className="reminder-selection-title">{current ? current.title : copy.pickReminder}</h2>
              {current && <p className="reminder-selection-due">{duePhrase(current.occurrenceAt || current.nextFireAt, settings?.language || 'es')}</p>}
            </div>
            <footer className="reminder-foot">
              <div className="reminder-actions">
                <button type="button" className="btn" onClick={stopAlert}><VolumeX size={14} />{copy.stopSound}</button>
                <button type="button" className="btn" disabled={previewMode || !current} onClick={() => current && void api.openItem(current.id)}><ExternalLink size={14} />{copy.openItem}</button>
                <button type="button" className="btn" disabled={previewMode || !current} onClick={() => current && void api.dismiss(current.id)}><X size={14} />{copy.dismiss}</button>
                <button type="button" className="btn btn-danger" disabled={previewMode || !items.length} onClick={() => void api.dismissAll()}><XCircle size={14} />{copy.dismissAll}</button>
              </div>
              <div className="reminder-snooze">
                <span className="reminder-snooze-label">{copy.snoozeFor}</span>
                <button type="button" className="btn" disabled={previewMode || !current} onClick={() => current && void api.snooze(current.id, 10)}><Clock3 size={13} />{copy.min10}</button>
                <button type="button" className="btn" disabled={previewMode || !current} onClick={() => current && void api.snooze(current.id, 60)}>{copy.hour1}</button>
                <button type="button" className="btn" disabled={previewMode || !current} onClick={() => current && void api.snoozeTomorrow(current.id)}>{copy.tomorrow9}</button>
              </div>
              <div className="reminder-custom">
                <input type="number" min={1} value={amount} aria-label={copy.snoozeFor} onChange={(e) => setAmount(Number(e.target.value))} />
                <select value={unit} aria-label={copy.snoozeFor} onChange={(e) => setUnit(e.target.value as 'minutes' | 'hours' | 'days')}>
                  <option value="minutes">{copy.minutes}</option>
                  <option value="hours">{copy.hours}</option>
                  <option value="days">{copy.days}</option>
                </select>
                <button type="button" className="btn btn-primary" disabled={previewMode || !current} onClick={() => current && void api.snooze(current.id, minutes)}><Timer size={14} />{copy.snooze}</button>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings?.reminderAlwaysOnTop ?? true}
                    onChange={(e) => void api.setAlwaysOnTop(e.target.checked)}
                  />
                  {copy.alwaysOnTop}
                </label>
              </div>
            </footer>
          </>
        )}
      </div>
      <TextContextMenu copy={copy} />
    </div>
  );
}
