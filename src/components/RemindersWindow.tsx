import { useEffect, useState } from 'react';
import type { Item, PublicSettings } from '@shared/types';
import { copyOf } from '../i18n';
import { duePhrase } from '../lib/format';
import { playAlert, stopAlert } from '../lib/sound';
import { applyTheme } from '../themes';
import TitleBar from './TitleBar';

export default function RemindersWindow() {
  const api = window.cyberGoAPI;
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [amount, setAmount] = useState(8);
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const copy = copyOf(settings?.language || 'es');

  async function reload(pulseIds: string[] = []) {
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
    void reload();
    const offData = api.onDataChanged(() => void reload());
    const off = api.onReminderUpdate((payload) => {
      void reload(payload.pulseIds);
      if (payload.sound) void playAlert();
    });
    return () => { offData(); off(); };
  }, []);

  const current = items.find((item) => item.id === selected) ?? null;
  const minutes = amount * (unit === 'hours' ? 60 : unit === 'days' ? 1440 : 1);

  return (
    <div className="reminder-app">
      <TitleBar title={copy.remindersTitle} />
      {!items.length ? (
        <div className="empty"><h2>{copy.noPending}</h2></div>
      ) : (
        <div className="reminder-list">
          {items.map((item) => (
            <button key={item.id} className={`reminder-row ${selected === item.id ? 'selected' : ''} ${pulse.includes(item.id) ? 'row pulse' : ''}`} onClick={() => setSelected(item.id)}>
              <strong className="subject">{item.title}</strong>
              <span className="muted">{duePhrase(item.occurrenceAt || item.nextFireAt, settings?.language || 'es')}</span>
            </button>
          ))}
        </div>
      )}
      <footer className="reminder-foot">
        <div className="hint">{current ? current.title : copy.pickReminder}</div>
        <div className="foot-buttons">
          <button className="btn" onClick={stopAlert}>{copy.stopSound}</button>
          <button className="btn" disabled={!current} onClick={() => current && void api.openItem(current.id)}>{copy.openItem}</button>
          <button className="btn" disabled={!current} onClick={() => current && void api.dismiss(current.id)}>{copy.dismiss}</button>
          <button className="btn" disabled={!items.length} onClick={() => void api.dismissAll()}>{copy.dismissAll}</button>
        </div>
        <div className="snooze-line">
          <span className="hint">{copy.snoozeFor}</span>
          <button className="btn" disabled={!current} onClick={() => current && void api.snooze(current.id, 10)}>{copy.min10}</button>
          <button className="btn" disabled={!current} onClick={() => current && void api.snooze(current.id, 60)}>{copy.hour1}</button>
          <button className="btn" disabled={!current} onClick={() => current && void api.snoozeTomorrow(current.id)}>{copy.tomorrow9}</button>
        </div>
        <div className="snooze-line">
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'minutes' | 'hours' | 'days')}>
            <option value="minutes">{copy.minutes}</option>
            <option value="hours">{copy.hours}</option>
            <option value="days">{copy.days}</option>
          </select>
          <button className="btn btn-primary" disabled={!current} onClick={() => current && void api.snooze(current.id, minutes)}>{copy.snooze}</button>
          <label className="check" style={{ marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={settings?.reminderAlwaysOnTop ?? true}
              onChange={(e) => void api.setAlwaysOnTop(e.target.checked)}
            />
            {copy.alwaysOnTop}
          </label>
        </div>
      </footer>
    </div>
  );
}
