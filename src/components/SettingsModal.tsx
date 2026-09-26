import { useEffect, useState } from 'react';
import type { Copy } from '../i18n';
import type { PublicSettings } from '@shared/types';
import { applyTheme } from '../themes';
import { playAlert } from '../lib/sound';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

type Tab = 'general' | 'notifications' | 'security' | 'data';

export default function SettingsModal({
  copy,
  settings,
  hasPassword,
  onClose,
  onLock,
}: {
  copy: Copy;
  settings: PublicSettings;
  hasPassword: boolean;
  onClose: () => void;
  onLock: () => void;
}) {
  const api = window.cyberGoAPI;
  const [tab, setTab] = useState<Tab>('general');
  const [hint, setHint] = useState(settings.passwordHint);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState('');
  const [backups, setBackups] = useState<{ name: string; createdAt: string; bytes: number }[]>([]);
  const [keep, setKeep] = useState(settings.autobackupKeep);
  const [restoreName, setRestoreName] = useState<string | null>(null);

  useModalKeys(true, {
    esc: () => {
      if (restoreName) setRestoreName(null);
      else onClose();
    },
    enter: restoreName ? () => {
      void api.restoreBackup(restoreName).then(() => setMessage(copy.saved));
      setRestoreName(null);
    } : undefined,
  });

  const refreshBackups = () => api.listBackups().then(setBackups);
  useEffect(() => { if (tab === 'data') void refreshBackups(); }, [tab]);

  async function patch(partial: Partial<PublicSettings>) {
    const saved = await api.patchSettings(partial);
    if (partial.theme) applyTheme(saved.theme);
    setMessage(copy.saved);
  }

  function explain(error: string) {
    if (error === 'short') return copy.shortPassword;
    if (error === 'wait') return copy.wait;
    if (error === 'wrong') return copy.wrongPassword;
    return error;
  }

  async function createPassword() {
    const result = await api.setPassword(next, hint);
    if (!result.ok) return setMessage(explain(result.error));
    setRecovery(result.recoveryCode);
    setNext('');
    setMessage('');
  }

  async function changePassword() {
    const result = await api.changePassword(current, next, hint);
    if (!result.ok) return setMessage(explain(result.error));
    setRecovery(result.recoveryCode);
    setCurrent('');
    setNext('');
    setMessage('');
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{copy.settings}</h2>
        <div className="tabs">
          {(['general', 'notifications', 'security', 'data'] as Tab[]).map((id) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setMessage(''); }}>{copy[id === 'data' ? 'data' : id]}</button>
          ))}
        </div>

        {tab === 'general' && (
          <>
            <label className="field">
              <span>{copy.language}</span>
              <select value={settings.language} onChange={(e) => void patch({ language: e.target.value as 'es' | 'en' })}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className="field">
              <span>{copy.theme}</span>
              <div className="themes">
                {([['cybergo', copy.themeCyber], ['gray', copy.themeGray], ['light', copy.themeLight]] as const).map(([id, label]) => (
                  <button key={id} className={`theme-card ${settings.theme === id ? 'on' : ''}`} onClick={() => void patch({ theme: id })}>
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={settings.openAtLogin} onChange={(e) => void patch({ openAtLogin: e.target.checked })} />
              {copy.startWithWindows}
            </label>
            <p className="hint">{copy.trayHint}</p>
          </>
        )}

        {tab === 'notifications' && (
          <>
            <label className="check">
              <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => void patch({ soundEnabled: e.target.checked })} />
              {copy.sound}: {copy.soundOn}
            </label>
            <p className="hint">{settings.soundPath || copy.defaultSound}</p>
            <p className="hint">{copy.soundHelp}</p>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn" onClick={() => void api.pickSound()}>{copy.chooseSound}</button>
              <button className="btn" onClick={() => void api.clearSound()}>{copy.defaultSound}</button>
              <button className="btn btn-primary" onClick={() => void playAlert()}>{copy.testSound}</button>
            </div>
          </>
        )}

        {tab === 'security' && (
          <>
            <div className="themes">
              <button className={`theme-card ${settings.lockLevel === 'soft' ? 'on' : ''}`} onClick={() => void patch({ lockLevel: 'soft' })}>
                <strong>{copy.lockSoft}</strong>
                <span className="hint">{copy.lockSoftHelp}</span>
              </button>
              <button className={`theme-card ${settings.lockLevel === 'hard' ? 'on' : ''}`} onClick={() => void patch({ lockLevel: 'hard' })}>
                <strong>{copy.lockHard}</strong>
                <span className="hint">{copy.lockHardHelp}</span>
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={settings.lockOnLaunch} onChange={(e) => void patch({ lockOnLaunch: e.target.checked })} />
              {copy.lockOnLaunch}
            </label>
            {!hasPassword && <p className="hint">{copy.noPassword}</p>}
            <label className="field"><span>{copy.hint}</span><input value={hint} placeholder={copy.hintOptional} onChange={(e) => setHint(e.target.value)} /></label>
            {hasPassword && <label className="field"><span>{copy.currentPassword}</span><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>}
            <label className="field"><span>{hasPassword ? copy.newPassword : copy.password}</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              {!hasPassword && <button className="btn btn-primary" onClick={() => void createPassword()}>{copy.setPassword}</button>}
              {hasPassword && <button className="btn btn-primary" onClick={() => void changePassword()}>{copy.changePassword}</button>}
              {hasPassword && <button className="btn btn-danger" onClick={() => void api.removePassword(current).then((ok) => setMessage(ok ? copy.saved : copy.wrongPassword))}>{copy.removePassword}</button>}
              {hasPassword && <button className="btn" onClick={onLock}>{copy.lockNow}</button>}
            </div>
            {recovery && (
              <div className="field">
                <span>{copy.recoveryCode}</span>
                <strong>{recovery}</strong>
                <p className="hint">{copy.recoveryHelp}</p>
                <button className="btn" onClick={() => setRecovery('')}>{copy.recoverySaved}</button>
              </div>
            )}
          </>
        )}

        {tab === 'data' && (
          <>
            <label className="check">
              <input type="checkbox" checked={settings.autobackup} onChange={(e) => void patch({ autobackup: e.target.checked })} />
              {copy.autobackup}
            </label>
            <label className="field">
              <span>{copy.keepLast}</span>
              <input type="number" min={1} max={60} value={keep} onChange={(e) => setKeep(Number(e.target.value))} onBlur={() => void patch({ autobackupKeep: keep || 7 })} />
            </label>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn btn-primary" onClick={() => void api.backupNow().then(() => { setMessage(copy.backupDone); void refreshBackups(); })}>{copy.backupNow}</button>
              <button className="btn" onClick={() => void api.openDataFolder()}>{copy.openFolder}</button>
              <button className="btn" onClick={() => void api.exportCsv()}>{copy.exportCsv}</button>
              <button className="btn" onClick={() => void api.importCsv().then((result) => result && setMessage(`${copy.imported}: ${result.added}${result.errors.length ? ` (${result.errors.length})` : ''}`))}>{copy.importCsv}</button>
            </div>
            <p className="hint">{copy.csvHelp}</p>
            <p className="hint">{copy.preRestore}</p>
            {backups.length === 0 && <p className="hint">{copy.noBackups}</p>}
            {backups.map((backup) => (
              <div className="backup-row" key={backup.name}>
                <span>{backup.name}</span>
                <button className="btn" onClick={() => setRestoreName(backup.name)}>{copy.restoreBackup}</button>
              </div>
            ))}
          </>
        )}

        {restoreName && (
          <div className="field">
            <span>{copy.confirmRestore}</span>
            <p className="hint">{copy.confirmRestoreBody}</p>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn" onClick={() => setRestoreName(null)}>{copy.cancel}<EscHint /></button>
              <button className="btn btn-primary" onClick={() => { void api.restoreBackup(restoreName).then(() => setMessage(copy.saved)); setRestoreName(null); }}>{copy.restoreBackup}<EnterGlyph /></button>
            </div>
          </div>
        )}

        <div className="hint">{message}</div>
        <div className="row-actions">
          <button className="btn" onClick={onClose}>{copy.close}{!restoreName && <EscHint />}</button>
        </div>
      </div>
    </div>
  );
}
