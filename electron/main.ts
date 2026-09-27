import crypto from 'crypto';
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { itemToCsvRow, parseCsv, rowToDraft, toCsv } from '../shared/csv';
import { parseIcs } from '../shared/ics';
import { fireKey, isDue, parseLocal, tomorrowAtNine } from '../shared/schedule';
import { normalizeAuthSecret } from '../shared/auth';
import type { AuthMethod, Item, ItemDraft, PublicSettings } from '../shared/types';
import * as db from './db';

const here = path.dirname(fileURLToPath(import.meta.url));
const verify = process.env.CYBERGO_VERIFY === '1';

function bootLog(message: string) {
  if (!verify) return;
  fs.appendFileSync(path.join(os.tmpdir(), 'cybergo-boot.txt'), `${new Date().toISOString()} ${message}\n`);
}

if (verify) {
  app.setPath('userData', path.join(os.tmpdir(), 'cybergo-verify'));
}

let mainWindow: BrowserWindow | null = null;
let reminderWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sessionLocked = false;
let quitting = false;
let pendingNavigate: string | null = null;
let failCount = 0;
let failUntil = 0;
const locale = () => (app.getLocale().toLowerCase().startsWith('es') ? 'es' : 'en') as 'es' | 'en';

function fromPublic(rel: string): string {
  const candidates = [
    path.join(here, '../public', rel),
    path.join(here, '../dist', rel),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function wasmPath(): string {
  const dev = path.join(here, '../node_modules/sql.js/dist/sql-wasm.wasm');
  const prod = path.join(process.resourcesPath, 'sql-wasm.wasm');
  return fs.existsSync(dev) ? dev : prod;
}

function soundFile(): string {
  const custom = db.getSetting('sound_path') || '';
  if (custom && fs.existsSync(custom)) return custom;
  return fromPublic('sounds/chime.wav');
}

function broadcast(channel: string, payload?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function snapshot() {
  const locked = sessionLocked;
  return {
    items: locked ? [] : db.listItems(),
    groups: locked ? [] : db.listGroups(),
    settings: db.readSettings(locale()),
    locked,
    hasPassword: db.hasPassword(),
  };
}

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** Global quick capture: bring the app up and land the cursor in the QuickAdd field. */
function quickCapture() {
  showMain();
  if (!mainWindow || sessionLocked) return;
  mainWindow.webContents.send('quick-add:focus');
}

let trayToggleAt = 0;

function toggleMainFromTray() {
  const now = Date.now();
  if (now - trayToggleAt < 400) return;
  trayToggleAt = now;
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isVisible() && !win.isMinimized()) {
    win.hide();
    return;
  }
  showMain();
}

function flushNavigate() {
  if (!pendingNavigate || !mainWindow || sessionLocked) return;
  const id = pendingNavigate;
  pendingNavigate = null;
  mainWindow.webContents.send('open-item', id);
}

function applyLogin(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [path.resolve(app.getAppPath())],
  });
}

function backupsDir() {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createBackup(kind: 'auto' | 'manual' | 'pre-restore'): string {
  const name = `cybergo-${kind}-${stamp()}.db`;
  fs.copyFileSync(db.databasePath(), path.join(backupsDir(), name));
  return name;
}

function pruneBackups(keep: number) {
  const dir = backupsDir();
  const files = fs.readdirSync(dir)
    .filter((name) => name.startsWith('cybergo-') && name.endsWith('.db'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const file of files.slice(Math.max(1, keep))) {
    fs.unlinkSync(path.join(dir, file.name));
  }
}

function maybeAutoBackup() {
  const settings = db.readSettings(locale());
  if (!settings.autobackup) return;
  const last = db.autobackupLast();
  if (last && Date.now() - new Date(last).getTime() < 24 * 60 * 60 * 1000) return;
  createBackup('auto');
  db.touchAutobackup(new Date().toISOString());
  pruneBackups(settings.autobackupKeep);
}

function listBackups() {
  const dir = backupsDir();
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, createdAt: stat.mtime.toISOString(), bytes: stat.size };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function showReminderWindow(opts: { sound: boolean; pulseIds: string[]; focus?: boolean }) {
  const always = db.readSettings(locale()).reminderAlwaysOnTop;
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    reminderWindow = new BrowserWindow({
      width: 440,
      height: 560,
      minWidth: 360,
      minHeight: 420,
      show: false,
      frame: false,
      alwaysOnTop: always,
      backgroundColor: '#0c0c12',
      icon: fromPublic('icon.png'),
      webPreferences: {
        preload: path.join(here, fs.existsSync(path.join(here, 'preload.js')) ? 'preload.js' : 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    reminderWindow.setAlwaysOnTop(always, 'floating');
    reminderWindow.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      reminderWindow?.hide();
    });
    const dev = process.env.VITE_DEV_SERVER_URL;
    if (dev) await reminderWindow.loadURL(dev + '#/reminders');
    else await reminderWindow.loadFile(path.join(here, '../dist/index.html'), { hash: '/reminders' });
  }
  const send = () => {
    if (!reminderWindow || reminderWindow.isDestroyed()) return;
    reminderWindow.webContents.send('reminder:update', opts);
  };
  if (reminderWindow.webContents.isLoading()) reminderWindow.webContents.once('did-finish-load', send);
  else send();
  if (opts.focus) reminderWindow.show();
  else reminderWindow.showInactive();
}

function hideReminders() {
  if (reminderWindow && !reminderWindow.isDestroyed() && reminderWindow.isVisible()) reminderWindow.hide();
}

/** Native Windows toast as a fallback for the floating window. Click opens reminders, buttons act directly. */
function toastFor(fresh: Item[]) {
  if (!fresh.length || !Notification.isSupported()) return;
  const settings = db.readSettings(locale());
  const es = locale() === 'es';
  const title = fresh.length === 1
    ? fresh[0].title
    : es ? `${fresh.length} avisos pendientes` : `${fresh.length} pending reminders`;
  const note = new Notification({
    title: `CyberGo: ${title}`,
    body: es ? 'Clic para ver los avisos' : 'Click to view reminders',
    silent: !settings.soundEnabled,
    icon: fromPublic('icon.png'),
    actions: [
      { type: 'button', text: es ? 'Abrir' : 'Open' },
      { type: 'button', text: es ? 'Descartar' : 'Dismiss' },
    ],
  });
  note.on('click', () => void evaluateReminders('show'));
  note.on('action', (_event, index) => {
    if (index === 0) {
      void evaluateReminders('show');
      return;
    }
    for (const item of fresh) db.dismissItem(item.id);
    afterReminderChange();
  });
  note.show();
}

async function evaluateReminders(reason: 'tick' | 'unlock' | 'show') {
  const settings = db.readSettings(locale());
  if (sessionLocked && settings.lockLevel === 'hard') {
    hideReminders();
    if (reason === 'show') showMain();
    return;
  }
  const due = db.listItems().filter((item) => isDue(item, Date.now()));
  const fresh = due.filter((item) => item.alertKey !== fireKey(item));
  const shouldShow = reason === 'show'
    || (reason === 'tick' && fresh.length > 0)
    || (reason === 'unlock' && settings.lockLevel === 'hard' && due.length > 0)
    || (reason === 'unlock' && fresh.length > 0);
  if (!shouldShow) return;
  await showReminderWindow({
    sound: settings.soundEnabled && fresh.length > 0,
    pulseIds: fresh.map((item) => item.id),
    focus: reason === 'show',
  });
  if (fresh.length) db.markAlerted(fresh.map((item) => item.id));
  if (reason === 'tick' && fresh.length) toastFor(fresh);
}

function changed() {
  broadcast('data:changed');
}

function afterReminderChange() {
  const due = db.listItems().filter((item) => isDue(item, Date.now()));
  if (!due.length) hideReminders();
  changed();
  if (due.length) broadcast('reminder:update', { sound: false, pulseIds: [] });
}

function methodOf(value: unknown): AuthMethod {
  return value === 'pin' ? 'pin' : 'password';
}

function presented(value: unknown, method: AuthMethod): string {
  const raw = typeof value === 'string' ? value : '';
  return method === 'pin' ? raw.trim() : raw;
}

function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (const b of bytes) raw += alphabet[b % alphabet.length];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function tooManyAttempts(): boolean {
  return Date.now() < failUntil;
}

function noteFailure() {
  failCount += 1;
  if (failCount >= 5) {
    failUntil = Date.now() + 30_000;
    failCount = 0;
  }
}

function noteSuccess() {
  failCount = 0;
  failUntil = 0;
}

function createMain() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#0c0c12',
    icon: fromPublic('icon.png'),
    webPreferences: {
      preload: path.join(here, fs.existsSync(path.join(here, 'preload.js')) ? 'preload.js' : 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void mainWindow.loadURL(dev);
  else void mainWindow.loadFile(path.join(here, '../dist/index.html'));
}

function createTray() {
  const image = nativeImage.createFromPath(fromPublic('tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('CyberGo');
  const es = locale() === 'es';
  const menu = Menu.buildFromTemplate([
    { label: es ? 'Abrir CyberGo' : 'Open CyberGo', click: () => showMain() },
    { label: es ? 'Captura rápida' : 'Quick capture', accelerator: 'Alt+Shift+G', click: () => quickCapture() },
    { label: es ? 'Avisos' : 'Reminders', click: () => void evaluateReminders('show') },
    { label: es ? 'Bloquear' : 'Lock', click: () => { if (db.hasPassword()) { sessionLocked = true; hideReminders(); changed(); showMain(); } } },
    { type: 'separator' },
    { label: es ? 'Salir' : 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => toggleMainFromTray());
  tray.on('double-click', () => toggleMainFromTray());
}

function registerIpc() {
  ipcMain.handle('bootstrap:get', () => snapshot());
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.handle('window:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.handle('window:is-maximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);

  ipcMain.handle('items:save', (_e, draft: ItemDraft) => {
    const item = db.saveItem(draft);
    changed();
    void evaluateReminders('tick');
    return item;
  });
  ipcMain.handle('items:delete', (_e, id: string) => { db.softDelete(id); changed(); });
  ipcMain.handle('items:restore', (_e, id: string) => { db.restoreItem(id); changed(); });
  ipcMain.handle('items:purge', (_e, id: string) => { db.purgeItem(id); changed(); });
  ipcMain.handle('items:empty-trash', () => { db.emptyTrash(); changed(); });
  ipcMain.handle('items:complete', (_e, id: string) => { db.completeItem(id); changed(); });
  ipcMain.handle('groups:save', (_e, input: { id?: string; name: string; color: string }) => {
    const group = db.saveGroup(input);
    changed();
    return group;
  });
  ipcMain.handle('groups:delete', (_e, id: string) => { db.deleteGroup(id); changed(); });

  ipcMain.handle('settings:patch', (_e, patch: Partial<PublicSettings>) => {
    db.applySettingsPatch(patch);
    if (patch.openAtLogin != null) applyLogin(patch.openAtLogin);
    if (patch.reminderAlwaysOnTop != null && reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.setAlwaysOnTop(patch.reminderAlwaysOnTop, 'floating');
    }
    if (patch.lockLevel === 'hard' && sessionLocked) hideReminders();
    if (patch.lockLevel === 'soft' && sessionLocked) void evaluateReminders('tick');
    changed();
    return db.readSettings(locale());
  });

  ipcMain.handle('auth:set', async (_e, password: string, hint: string, method: unknown) => {
    if (db.hasPassword()) return { ok: false as const, error: 'exists' };
    const mode = methodOf(method);
    const secret = normalizeAuthSecret(presented(password, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const code = recoveryCode();
    db.setPasswordHash(await bcrypt.hash(secret, 10));
    db.setRecoveryHash(await bcrypt.hash(code.replace('-', ''), 10));
    db.setAuthMethod(mode);
    db.applySettingsPatch({ passwordHint: hint || '', lockOnLaunch: true });
    changed();
    return { ok: true as const, recoveryCode: code };
  });
  ipcMain.handle('auth:change', async (_e, current: string, next: string, hint: string, method: unknown) => {
    if (tooManyAttempts()) return { ok: false as const, error: 'wait' };
    const hash = db.passwordHash();
    const stored = db.authMethod();
    if (!hash || !(await bcrypt.compare(presented(current, stored), hash))) {
      noteFailure();
      return { ok: false as const, error: 'wrong' };
    }
    const mode = methodOf(method);
    const secret = normalizeAuthSecret(presented(next, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const code = recoveryCode();
    db.setPasswordHash(await bcrypt.hash(secret, 10));
    db.setRecoveryHash(await bcrypt.hash(code.replace('-', ''), 10));
    db.setAuthMethod(mode);
    db.applySettingsPatch({ passwordHint: hint });
    noteSuccess();
    changed();
    return { ok: true as const, recoveryCode: code };
  });
  ipcMain.handle('auth:remove', async (_e, current: string) => {
    if (tooManyAttempts()) return false;
    const hash = db.passwordHash();
    const stored = db.authMethod();
    if (!hash || !(await bcrypt.compare(presented(current, stored), hash))) {
      noteFailure();
      return false;
    }
    db.clearAuth();
    sessionLocked = false;
    noteSuccess();
    changed();
    return true;
  });
  ipcMain.handle('auth:unlock', async (_e, password: string) => {
    if (tooManyAttempts()) {
      db.recordAccessEvent('blocked', db.authMethod());
      return 'wait';
    }
    const hash = db.passwordHash();
    if (!hash) {
      sessionLocked = false;
      return 'ok';
    }
    const stored = db.authMethod();
    if (!(await bcrypt.compare(presented(password, stored), hash))) {
      noteFailure();
      db.recordAccessEvent('failure', stored);
      return 'wrong';
    }
    noteSuccess();
    db.recordAccessEvent('success', stored);
    sessionLocked = false;
    changed();
    flushNavigate();
    void evaluateReminders('unlock');
    return 'ok';
  });
  ipcMain.handle('auth:recover', async (_e, code: string, next: string, method: unknown) => {
    if (tooManyAttempts()) {
      db.recordAccessEvent('blocked', 'recovery');
      return { ok: false as const, error: 'wait' };
    }
    const hash = db.recoveryHash();
    const normalized = code.trim().toUpperCase().replace(/-/g, '');
    if (!hash || !(await bcrypt.compare(normalized, hash))) {
      noteFailure();
      db.recordAccessEvent('recovery-failure', 'recovery');
      return { ok: false as const, error: 'wrong' };
    }
    const mode = method === undefined ? db.authMethod() : methodOf(method);
    const secret = normalizeAuthSecret(presented(next, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const fresh = recoveryCode();
    db.setPasswordHash(await bcrypt.hash(secret, 10));
    db.setRecoveryHash(await bcrypt.hash(fresh.replace('-', ''), 10));
    db.setAuthMethod(mode);
    noteSuccess();
    db.recordAccessEvent('recovery-success', 'recovery');
    sessionLocked = false;
    changed();
    flushNavigate();
    void evaluateReminders('unlock');
    return { ok: true as const, recoveryCode: fresh };
  });
  ipcMain.handle('auth:lock', () => {
    if (!db.hasPassword()) return false;
    sessionLocked = true;
    if (db.readSettings(locale()).lockLevel === 'hard') hideReminders();
    changed();
    showMain();
    return true;
  });

  ipcMain.handle('access-log:list', () => db.listAccessLog());
  ipcMain.handle('access-log:clear', () => {
    db.clearAccessLog();
    changed();
  });

  ipcMain.handle('reminders:due', () => db.listItems().filter((item) => isDue(item, Date.now())));
  ipcMain.handle('reminders:show', () => evaluateReminders('show'));
  ipcMain.handle('reminders:snooze', (_e, id: string, minutes: number) => {
    db.snoozeMinutes(id, minutes);
    afterReminderChange();
  });
  ipcMain.handle('reminders:snooze-until', (_e, id: string, iso: string) => {
    db.snoozeItem(id, iso);
    afterReminderChange();
  });
  ipcMain.handle('reminders:tomorrow', (_e, id: string) => {
    db.snoozeItem(id, tomorrowAtNine());
    afterReminderChange();
  });
  ipcMain.handle('reminders:dismiss', (_e, id: string) => {
    db.dismissItem(id);
    afterReminderChange();
  });
  ipcMain.handle('reminders:dismiss-all', () => {
    for (const item of db.listItems().filter((row) => isDue(row, Date.now()))) db.dismissItem(item.id);
    afterReminderChange();
  });
  ipcMain.handle('reminders:always-on-top', (_e, value: boolean) => {
    db.applySettingsPatch({ reminderAlwaysOnTop: value });
    if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.setAlwaysOnTop(value, 'floating');
    changed();
  });
  ipcMain.handle('reminders:open-item', (_e, id: string) => {
    pendingNavigate = id;
    showMain();
    if (!sessionLocked) flushNavigate();
  });
  ipcMain.handle('sound:path', () => soundFile());
  ipcMain.handle('sound:pick', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }],
        properties: ['openFile'],
      })
      : await dialog.showOpenDialog({
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }],
        properties: ['openFile'],
      });
    if (result.canceled || !result.filePaths[0]) return null;
    db.applySettingsPatch({ soundPath: result.filePaths[0] });
    changed();
    return result.filePaths[0];
  });
  ipcMain.handle('sound:clear', () => {
    db.applySettingsPatch({ soundPath: '' });
    changed();
  });

  ipcMain.handle('backup:now', () => {
    const name = createBackup('manual');
    pruneBackups(db.readSettings(locale()).autobackupKeep);
    return name;
  });
  ipcMain.handle('backup:list', () => listBackups());
  ipcMain.handle('backup:restore', (_e, name: string) => {
    const safe = path.basename(name);
    const source = path.join(backupsDir(), safe);
    if (!fs.existsSync(source)) return false;
    createBackup('pre-restore');
    fs.copyFileSync(source, db.databasePath());
    db.reloadFromDisk();
    sessionLocked = db.hasPassword() && db.readSettings(locale()).lockOnLaunch;
    changed();
    return true;
  });
  ipcMain.handle('data:open-folder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('csv:export', async () => {
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'cybergo.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      : await dialog.showSaveDialog({
        defaultPath: 'cybergo.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
    if (result.canceled || !result.filePath) return false;
    const dumped = db.exportRows();
    const csv = toCsv(dumped.items.map((item) => itemToCsvRow(item, dumped.groups)));
    fs.writeFileSync(result.filePath, `\uFEFF${csv}`, 'utf8');
    return true;
  });
  ipcMain.handle('csv:import', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile'],
      })
      : await dialog.showOpenDialog({
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile'],
      });
    if (result.canceled || !result.filePaths[0]) return null;
    const text = fs.readFileSync(result.filePaths[0], 'utf8');
    const rows = parseCsv(text);
    const errors: string[] = [];
    let added = 0;
    rows.forEach((row, index) => {
      try {
        const { draft, newGroupName } = rowToDraft(row, db.listGroups());
        if (newGroupName) {
          const group = db.saveGroup({ name: newGroupName, color: '#6c63e6' });
          draft.groupId = group.id;
        }
        if (draft.startLocal && draft.endLocal) {
          const start = parseLocal(draft.startLocal, draft.allDay);
          const end = parseLocal(draft.endLocal, draft.allDay);
          if (end.getTime() < start.getTime()) throw new Error('end');
        }
        db.saveItem(draft);
        added += 1;
      } catch (error) {
        errors.push(`${index + 2}: ${error instanceof Error ? error.message : 'invalid'}`);
      }
    });
    changed();
    void evaluateReminders('tick');
    return { added, errors };
  });
  ipcMain.handle('ics:import', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'Calendar', extensions: ['ics'] }],
        properties: ['openFile'],
      })
      : await dialog.showOpenDialog({
        filters: [{ name: 'Calendar', extensions: ['ics'] }],
        properties: ['openFile'],
      });
    if (result.canceled || !result.filePaths[0]) return null;
    const text = fs.readFileSync(result.filePaths[0], 'utf8');
    let events;
    try {
      events = parseIcs(text);
    } catch (error) {
      return { added: 0, errors: [error instanceof Error ? error.message : 'invalid'] };
    }
    const errors: string[] = [];
    let added = 0;
    events.forEach(({ draft }, index) => {
      try {
        db.saveItem(draft);
        added += 1;
      } catch (error) {
        errors.push(`${index + 1}: ${error instanceof Error ? error.message : 'invalid'}`);
      }
    });
    changed();
    void evaluateReminders('tick');
    return { added, errors };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.whenReady().then(async () => {
    bootLog('ready');
    app.setAppUserModelId('com.cybergo.app');
    Menu.setApplicationMenu(null);
    await db.initDatabase(path.join(app.getPath('userData'), 'cybergo.db'), wasmPath(), locale());
    if (verify) db.seedDemoIfEmpty();
    const settings = db.readSettings(locale());
    applyLogin(settings.openAtLogin);
    sessionLocked = db.hasPassword() && settings.lockOnLaunch;
    maybeAutoBackup();
    registerIpc();
    createMain();
    createTray();
    if (!globalShortcut.register('Alt+Shift+G', () => quickCapture())) {
      console.error('CyberGo: could not register the Alt+Shift+G quick-capture hotkey.');
    }
    setTimeout(() => void evaluateReminders('tick'), 800);
    setInterval(() => void evaluateReminders('tick'), 15_000);
    setInterval(() => maybeAutoBackup(), 60 * 60 * 1000);
    if (verify && mainWindow) {
      bootLog('verify hook');
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(async () => {
          fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
          const shot = await mainWindow?.capturePage();
          if (shot) fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'boot-main.png'), shot.toPNG());
          await evaluateReminders('show');
          setTimeout(async () => {
            const shot2 = await reminderWindow?.capturePage();
            if (shot2) fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'boot-reminders.png'), shot2.toPNG());
            quitting = true;
            app.quit();
          }, 900);
        }, 900);
      });
    }
  }).catch((error: unknown) => {
    const text = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(path.join(os.tmpdir(), 'cybergo-boot.txt'), `${new Date().toISOString()} ${text}\n`);
    app.exit(1);
  });
}

app.on('window-all-closed', () => {
  if (quitting) app.quit();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
