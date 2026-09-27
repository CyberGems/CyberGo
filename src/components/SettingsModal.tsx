import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, KeyRound, Trash2 } from 'lucide-react';
import type { Copy } from '../i18n';
import type { AccessLogEntry, AccessLogEvent, AccessLogMethod, AuthMethod, PublicSettings } from '@shared/types';
import { applyTheme } from '../themes';
import { playAlert } from '../lib/sound';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

type Tab = 'general' | 'notifications' | 'security' | 'data';

function accessEventLabel(copy: Copy, event: AccessLogEvent) {
  if (event === 'success') return copy.accessSuccess;
  if (event === 'failure') return copy.accessFailure;
  if (event === 'recovery-success') return copy.accessRecoverySuccess;
  if (event === 'recovery-failure') return copy.accessRecoveryFailure;
  return copy.accessBlocked;
}

function accessMethodLabel(copy: Copy, method: AccessLogMethod) {
  if (method === 'pin') return copy.accessMethodPin;
  if (method === 'recovery') return copy.accessMethodRecovery;
  return copy.accessMethodPassword;
}

function accessEventIcon(event: AccessLogEvent) {
  if (event === 'success' || event === 'recovery-success') return <CheckCircle2 size={15} />;
  if (event === 'failure' || event === 'recovery-failure') return <CircleAlert size={15} />;
  return <AlertTriangle size={15} />;
}

function formatAccessTime(iso: string, language: 'es' | 'en') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

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
  const [method, setMethod] = useState<AuthMethod>(settings.authMethod);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState('');
  const [backups, setBackups] = useState<{ name: string; createdAt: string; bytes: number }[]>([]);
  const [keep, setKeep] = useState(settings.autobackupKeep);
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [clearAccessConfirm, setClearAccessConfirm] = useState(false);

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
  const refreshAccessLog = () => api.listAccessLog().then(setAccessLog);
  useEffect(() => { if (tab === 'data') void refreshBackups(); }, [tab]);
  useEffect(() => { if (tab === 'security') void refreshAccessLog(); }, [tab]);

  async function patch(partial: Partial<PublicSettings>) {
    const saved = await api.patchSettings(partial);
    if (partial.theme) applyTheme(saved.theme);
    if (partial.accessLogEnabled != null) void refreshAccessLog();
    setMessage(copy.saved);
  }

  function explain(error: string) {
    if (error === 'short') return copy.shortPassword;
    if (error === 'pin') return copy.pinShort;
    if (error === 'wait') return copy.wait;
    if (error === 'wrong') return settings.authMethod === 'pin' ? copy.wrongPin : copy.wrongPassword;
    return error;
  }

  function digits(value: string) {
    return value.replace(/\D/g, '').slice(0, 8);
  }

  function pickMethod(nextMethod: AuthMethod) {
    setMethod(nextMethod);
    if (nextMethod === 'pin') setNext((value) => digits(value));
  }

  async function createPassword() {
    const result = await api.setPassword(next, hint, method);
    if (!result.ok) return setMessage(explain(result.error));
    setRecovery(result.recoveryCode);
    setNext('');
    setMessage('');
  }

  async function changePassword() {
    const result = await api.changePassword(current, next, hint, method);
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
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setMessage(''); setClearAccessConfirm(false); }}>{copy[id === 'data' ? 'data' : id]}</button>
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
            <div className="field">
              <span>{copy.kind}</span>
              <div className="seg">
                <button type="button" className={method === 'password' ? 'on' : ''} onClick={() => pickMethod('password')}>{copy.password}</button>
                <button type="button" className={method === 'pin' ? 'on' : ''} onClick={() => pickMethod('pin')}>{copy.authPin}</button>
              </div>
              {method === 'pin' && <p className="hint">{copy.pinDigits}</p>}
            </div>
            <label className="field"><span>{copy.hint}</span><input value={hint} placeholder={copy.hintOptional} onChange={(e) => setHint(e.target.value)} /></label>
            {hasPassword && (
              <label className="field">
                <span>{settings.authMethod === 'pin' ? copy.currentPin : copy.currentPassword}</span>
                <input
                  type="password"
                  value={current}
                  inputMode={settings.authMethod === 'pin' ? 'numeric' : undefined}
                  className={settings.authMethod === 'pin' ? 'pin-input' : undefined}
                  autoComplete="off"
                  onChange={(e) => setCurrent(settings.authMethod === 'pin' ? digits(e.target.value) : e.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>{method === 'pin' ? (hasPassword ? copy.newPin : copy.authPin) : (hasPassword ? copy.newPassword : copy.password)}</span>
              <input
                type="password"
                value={next}
                inputMode={method === 'pin' ? 'numeric' : undefined}
                className={method === 'pin' ? 'pin-input' : undefined}
                autoComplete="new-password"
                onChange={(e) => setNext(method === 'pin' ? digits(e.target.value) : e.target.value)}
              />
            </label>
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              {!hasPassword && <button className="btn btn-primary" onClick={() => void createPassword()}>{method === 'pin' ? copy.setPin : copy.setPassword}</button>}
              {hasPassword && <button className="btn btn-primary" onClick={() => void changePassword()}>{method === 'pin' ? copy.changePin : copy.changePassword}</button>}
              {hasPassword && <button className="btn btn-danger" onClick={() => void api.removePassword(current).then((ok) => setMessage(ok ? copy.saved : (settings.authMethod === 'pin' ? copy.wrongPin : copy.wrongPassword)))}>{settings.authMethod === 'pin' ? copy.removePin : copy.removePassword}</button>}
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
            <section className={`settings-section access-log-section ${!settings.accessLogEnabled ? 'is-disabled' : ''}`}>
              <div className="settings-section-heading">
                <div>
                  <h3>{copy.accessLog}</h3>
                  <p className="hint">{copy.accessLogHelp}</p>
                </div>
                <KeyRound size={18} aria-hidden="true" />
              </div>
              <label className="check">
                <input type="checkbox" checked={settings.accessLogEnabled} onChange={(e) => void patch({ accessLogEnabled: e.target.checked })} />
                {copy.accessLogEnabled}
              </label>
              <p className="hint">{settings.accessLogEnabled ? copy.accessLogRetention : copy.accessLogDisabled}</p>
              <div className="access-log-panel" aria-disabled={!settings.accessLogEnabled}>
                {accessLog.length === 0 ? (
                  <p className="access-log-empty">{copy.accessLogEmpty}</p>
                ) : (
                  <div className="access-log" role="list" aria-label={copy.accessLog}>
                    {accessLog.map((entry) => (
                      <div className={`access-log-entry access-log-${entry.event}`} key={entry.id} role="listitem">
                        <span className="access-log-icon" aria-hidden="true">{accessEventIcon(entry.event)}</span>
                        <span className="access-log-copy">
                          <strong>{accessEventLabel(copy, entry.event)}</strong>
                          <span>{accessMethodLabel(copy, entry.method)} · {formatAccessTime(entry.occurredAt, settings.language)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  <button className="btn btn-danger" disabled={!settings.accessLogEnabled || accessLog.length === 0} onClick={() => setClearAccessConfirm(true)}>
                    <Trash2 size={14} />{copy.clearAccessLog}
                  </button>
                </div>
                {clearAccessConfirm && (
                  <div className="access-log-confirm">
                    <strong>{copy.confirmClearAccessLog}</strong>
                    <p className="hint">{copy.confirmClearAccessLogBody}</p>
                    <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                      <button className="btn" onClick={() => setClearAccessConfirm(false)}>{copy.cancel}<EscHint /></button>
                      <button
                        className="btn btn-danger"
                        onClick={() => void api.clearAccessLog().then(() => {
                          setAccessLog([]);
                          setClearAccessConfirm(false);
                          setMessage(copy.accessLogCleared);
                        })}
                      >
                        {copy.clearAccessLog}<EnterGlyph />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
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
              <button className="btn" onClick={() => void api.importIcs().then((result) => result && setMessage(`${copy.imported}: ${result.added}${result.errors.length ? ` (${result.errors.length})` : ''}`))}>{copy.importIcs}</button>
            </div>
            <p className="hint">{copy.csvHelp}</p>
            <p className="hint">{copy.icsHelp}</p>
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
