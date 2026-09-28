import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  Info,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Copy } from '../i18n';
import type {
  AccessLogEntry,
  AccessLogEvent,
  AccessLogMethod,
  AuthMethod,
  BackupInfo,
  CsvResult,
  DisplayInfo,
  PublicSettings,
  ReminderPosition,
} from '@shared/types';
import { applyTheme } from '../themes';
import { playAlert } from '../lib/sound';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';
import Tooltip from './Tooltip';

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

function formatBackupDate(iso: string, language: 'es' | 'en') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatBytes(bytes: number, language: 'es' | 'en') {
  if (bytes < 1024) return `${bytes} B`;
  const units = language === 'es' ? ['KB', 'MB', 'GB'] : ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function importErrorLabel(copy: Copy, error: string) {
  const match = /^(?:row\s+(\d+):\s*)?(.+)$/.exec(error);
  const row = match?.[1];
  const code = match?.[2] ?? error;
  const labels: Record<string, string> = {
    read: copy.dataReadError,
    'unsupported headers': copy.csvUnsupported,
    'missing title': copy.csvMissingTitle,
    'invalid date': copy.csvInvalidDate,
    'invalid time': copy.csvInvalidTime,
    end: copy.csvInvalidEnd,
    invalid: copy.csvInvalidRow,
  };
  const text = labels[code] ?? code;
  return row ? `${copy.csvRow} ${row}: ${text}` : text;
}

type DataBusy = 'backup' | 'export' | 'csv' | 'ics';
type DataNotice = { tone: 'success' | 'info' | 'error'; title: string; body?: string; details?: string[] };
const positionCells: Array<{ id: ReminderPosition | null; dot: 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br' | 'center' | null }> = [
  { id: 'top-left', dot: 'tl' },
  { id: 'top-center', dot: 'tc' },
  { id: 'top-right', dot: 'tr' },
  { id: null, dot: null },
  { id: null, dot: 'center' },
  { id: null, dot: null },
  { id: 'bottom-left', dot: 'bl' },
  { id: 'bottom-center', dot: 'bc' },
  { id: 'bottom-right', dot: 'br' },
];

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
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [keep, setKeep] = useState(settings.autobackupKeep);
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [clearAccessConfirm, setClearAccessConfirm] = useState(false);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [dataBusy, setDataBusy] = useState<DataBusy | null>(null);
  const [dataNotice, setDataNotice] = useState<DataNotice | null>(null);

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
  useEffect(() => {
    if (tab === 'data') {
      void refreshBackups().catch(() => setDataNotice({ tone: 'error', title: copy.dataLoadError }));
    }
  }, [tab]);
  useEffect(() => { if (tab === 'security') void refreshAccessLog(); }, [tab]);
  useEffect(() => {
    if (tab === 'notifications') {
      void api.listDisplays().then(setDisplays).catch(() => setDisplays([]));
    }
  }, [tab]);

  async function patch(partial: Partial<PublicSettings>) {
    const saved = await api.patchSettings(partial);
    if (partial.theme) applyTheme(saved.theme);
    if (partial.accessLogEnabled != null) void refreshAccessLog();
    setMessage(copy.saved);
  }

  async function previewReminderPlacement(
    override: Partial<Pick<PublicSettings, 'reminderDisplayId' | 'reminderDisplayBounds' | 'reminderPosition'>> = {},
  ) {
    setPreviewing(true);
    try {
      await api.previewReminders({
        reminderDisplayId: override.reminderDisplayId ?? settings.reminderDisplayId,
        reminderDisplayBounds: override.reminderDisplayBounds ?? settings.reminderDisplayBounds,
        reminderPosition: override.reminderPosition ?? settings.reminderPosition,
      });
    } finally {
      window.setTimeout(() => setPreviewing(false), 700);
    }
  }

  async function createBackup() {
    setDataBusy('backup');
    setDataNotice(null);
    try {
      await api.backupNow();
      await refreshBackups();
      setDataNotice({ tone: 'success', title: copy.backupDone, body: copy.backupCreatedBody });
    } catch {
      setDataNotice({ tone: 'error', title: copy.backupError });
    } finally {
      setDataBusy(null);
    }
  }

  async function exportCsv() {
    setDataBusy('export');
    setDataNotice(null);
    try {
      const exported = await api.exportCsv();
      setDataNotice(exported
        ? { tone: 'success', title: copy.exported, body: copy.exportedBody }
        : { tone: 'info', title: copy.actionCanceled });
    } catch {
      setDataNotice({ tone: 'error', title: copy.exportError });
    } finally {
      setDataBusy(null);
    }
  }

  function importNotice(result: CsvResult, kind: 'csv' | 'ics') {
    if (result.added === 0 && result.errors.length > 0) {
      return {
        tone: 'error' as const,
        title: kind === 'csv' ? copy.csvImportFailed : copy.icsImportFailed,
        body: result.errors.length === 1 ? importErrorLabel(copy, result.errors[0]) : `${result.errors.length} ${copy.importErrors}`,
        details: result.errors.length > 1 ? result.errors.slice(0, 8).map((error) => importErrorLabel(copy, error)) : undefined,
      };
    }
    if (result.errors.length > 0) {
      return {
        tone: 'info' as const,
        title: kind === 'csv' ? copy.csvImportPartial : copy.icsImportPartial,
        body: `${result.added} ${copy.importedItems} · ${result.errors.length} ${copy.importErrors}`,
        details: result.errors.slice(0, 8).map((error) => importErrorLabel(copy, error)),
      };
    }
    return {
      tone: 'success' as const,
      title: kind === 'csv' ? copy.csvImportSuccess : copy.icsImportSuccess,
      body: `${result.added} ${copy.importedItems}${result.fileName ? ` · ${result.fileName}` : ''}`,
    };
  }

  async function importData(kind: 'csv' | 'ics') {
    setDataBusy(kind);
    setDataNotice(null);
    try {
      const result = kind === 'csv' ? await api.importCsv() : await api.importIcs();
      if (!result) {
        setDataNotice({ tone: 'info', title: copy.actionCanceled });
      } else {
        setDataNotice(importNotice(result, kind));
      }
    } catch {
      setDataNotice({ tone: 'error', title: kind === 'csv' ? copy.csvImportFailed : copy.icsImportFailed, body: copy.dataReadError });
    } finally {
      setDataBusy(null);
    }
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
            <section className="settings-section notification-display-section">
              <div className="settings-section-heading">
                <div>
                  <h3>{copy.displayAndPosition}</h3>
                  <p className="hint">{copy.displayAndPositionHelp}</p>
                </div>
              </div>
              <label className="field">
                <span>{copy.displayMonitor}</span>
                <select
                  value={settings.reminderDisplayId}
                  onChange={(e) => {
                    const displayId = Number(e.target.value);
                    const selectedDisplay = displays.find((display) => display.id === displayId);
                    void patch({
                      reminderDisplayId: displayId,
                      reminderDisplayBounds: selectedDisplay
                        ? { x: selectedDisplay.x, y: selectedDisplay.y, width: selectedDisplay.width, height: selectedDisplay.height }
                        : null,
                    });
                  }}
                >
                  <option value={-1}>{copy.activeMonitor}</option>
                  {displays.map((display) => (
                    <option key={display.id} value={display.id}>{display.label}</option>
                  ))}
                </select>
              </label>
              <div className="notification-placement-row">
                <div>
                  <span className="label">{copy.notificationPosition}</span>
                  <div className="position-monitor" role="group" aria-label={copy.notificationPosition}>
                    {positionCells.map((cell, index) => {
                      if (!cell.id) {
                        return (
                          <div key={`space-${index}`} className="position-cell is-spacer">
                            {cell.dot === 'center' && <span className="position-center-mark" />}
                          </div>
                        );
                      }
                      const active = settings.reminderPosition === cell.id;
                      return (
                        <Tooltip key={cell.id} label={copy.positions[cell.id]} placement="top">
                          <button
                            type="button"
                            className={`position-cell${active ? ' is-active' : ''}`}
                            aria-label={copy.positions[cell.id]}
                            aria-pressed={active}
                            onClick={() => {
                              void patch({ reminderPosition: cell.id! });
                              void previewReminderPlacement({ reminderPosition: cell.id! });
                            }}
                          >
                            <span className={`position-dot ${cell.dot}`} />
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
                <button className="btn btn-primary notification-preview-btn" disabled={previewing} onClick={() => void previewReminderPlacement()}>
                  {previewing ? <LoaderCircle className="spin" size={15} /> : <BellRing size={15} />}
                  {previewing ? copy.previewingNotification : copy.previewNotification}
                </button>
              </div>
            </section>
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
          <div className="data-tab">
            <div className="data-intro">
              <div className="data-intro-icon"><HardDrive size={21} /></div>
              <div>
                <h3>{copy.dataTitle}</h3>
                <p>{copy.dataIntro}</p>
              </div>
            </div>

            <section className="data-card">
              <div className="data-card-heading">
                <div className="data-card-icon"><Archive size={17} /></div>
                <div>
                  <h3>{copy.automaticBackupTitle}</h3>
                  <p>{copy.automaticBackupHelp}</p>
                </div>
              </div>
              <label className="check data-check">
                <input type="checkbox" checked={settings.autobackup} onChange={(e) => { setDataNotice(null); void patch({ autobackup: e.target.checked }); }} />
                <span>{copy.autobackup}</span>
              </label>
              <label className="field data-retention">
                <span>{copy.keepLast}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={keep}
                  disabled={!settings.autobackup}
                  onChange={(e) => setKeep(Number(e.target.value))}
                  onBlur={() => void patch({ autobackupKeep: keep || 7 })}
                />
              </label>
            </section>

            <section className="data-card">
              <div className="data-card-heading">
                <div className="data-card-icon"><ShieldCheck size={17} /></div>
                <div>
                  <h3>{copy.dataActionsTitle}</h3>
                  <p>{copy.dataActionsHelp}</p>
                </div>
              </div>
              <div className="data-action-grid">
                <button className="data-action data-action-primary" disabled={dataBusy !== null} onClick={() => void createBackup()}>
                  {dataBusy === 'backup' ? <LoaderCircle className="spin" size={18} /> : <Archive size={18} />}
                  <span><strong>{copy.backupNow}</strong><small>{copy.backupNowHelp}</small></span>
                </button>
                <button
                  className="data-action"
                  disabled={dataBusy !== null}
                  onClick={() => void api.openDataFolder().then(() => setDataNotice({ tone: 'info', title: copy.folderOpened })).catch(() => setDataNotice({ tone: 'error', title: copy.folderError }))}
                >
                  <FolderOpen size={18} />
                  <span><strong>{copy.openFolder}</strong><small>{copy.openFolderHelp}</small></span>
                </button>
              </div>
            </section>

            <section className="data-card">
              <div className="data-card-heading">
                <div className="data-card-icon"><FileSpreadsheet size={17} /></div>
                <div>
                  <h3>{copy.transferTitle}</h3>
                  <p>{copy.transferHelp}</p>
                </div>
              </div>
              <div className="data-transfer-grid">
                <div className="data-transfer">
                  <Download size={16} />
                  <div><strong>{copy.exportTitle}</strong><p>{copy.exportHelp}</p></div>
                  <button className="btn" disabled={dataBusy !== null} onClick={() => void exportCsv()}>
                    {dataBusy === 'export' ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}{copy.exportCsv}
                  </button>
                </div>
                <div className="data-transfer">
                  <Upload size={16} />
                  <div><strong>{copy.importTitle}</strong><p>{copy.importHelp}</p></div>
                  <div className="data-transfer-actions">
                    <button className="btn" disabled={dataBusy !== null} onClick={() => void importData('csv')}>
                      {dataBusy === 'csv' ? <LoaderCircle className="spin" size={14} /> : <FileSpreadsheet size={14} />}{copy.importCsv}
                    </button>
                    <button className="btn" disabled={dataBusy !== null} onClick={() => void importData('ics')}>
                      {dataBusy === 'ics' ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{copy.importIcs}
                    </button>
                  </div>
                </div>
              </div>
              <p className="data-format-note"><Info size={14} />{copy.csvHelp}</p>
              <p className="data-format-note"><Info size={14} />{copy.icsHelp}</p>
            </section>

            {dataNotice && (
              <div className={`data-notice ${dataNotice.tone}`} role={dataNotice.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
                <span className="data-notice-icon">
                  {dataNotice.tone === 'success' ? <CheckCircle2 size={18} /> : dataNotice.tone === 'error' ? <CircleAlert size={18} /> : <Info size={18} />}
                </span>
                <div>
                  <strong>{dataNotice.title}</strong>
                  {dataNotice.body && <p>{dataNotice.body}</p>}
                  {dataNotice.details && dataNotice.details.length > 0 && (
                    <ul>{dataNotice.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>
                  )}
                </div>
              </div>
            )}

            <section className="data-card backup-list-card">
              <div className="data-card-heading backup-list-heading">
                <div className="data-card-icon"><Archive size={17} /></div>
                <div>
                  <h3>{copy.backupListTitle}</h3>
                  <p>{backups.length ? `${backups.length} ${copy.backupCount}` : copy.noBackups}</p>
                </div>
              </div>
              <p className="data-format-note"><ShieldCheck size={14} />{copy.preRestore}</p>
              {backups.length === 0 ? (
                <div className="backup-empty"><Archive size={22} /><span>{copy.noBackupsBody}</span></div>
              ) : (
                <div className="backup-list">
                  {backups.map((backup) => (
                    <div className="backup-row" key={backup.name}>
                      <div className="backup-row-icon"><Archive size={16} /></div>
                      <div className="backup-row-copy">
                        <strong>{backup.name}</strong>
                        <span>{formatBackupDate(backup.createdAt, settings.language)} · {formatBytes(backup.bytes, settings.language)}</span>
                      </div>
                      <button className="btn" onClick={() => setRestoreName(backup.name)}>{copy.restoreBackup}</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
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
