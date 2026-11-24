import crypto from 'crypto';
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, screen, session, shell, Tray } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { detectCsvFormat, itemToCsvRow, parseCsv, rowToDraft, toCsv } from '../shared/csv';
import { parseIcs } from '../shared/ics';
import { fireKey, isDue, parseLocal, tomorrowAtNine } from '../shared/schedule';
import { hashSecret, normalizeAuthSecret, verifySecret as verifyStoredSecret } from '../shared/auth';
import type { AuthMethod, DisplayBounds, DisplayInfo, Item, ItemDraft, PublicSettings, ReminderPosition, UpdateCheck, UpdateDownloadResult } from '../shared/types';
import * as db from './db';
import { asDraft, asId, asIsoDate, asNumber, asSettingsPatch, asText, methodOf, presented } from './validate';
import { MAIN_MIN_HEIGHT, MAIN_MIN_WIDTH, resolveReminderWindowSize, resolveWindowBounds, type SavedWindowBounds } from './window-bounds';
import { formatTrayTooltip } from './tray-tooltip';
import { findReleaseInstaller, UpdateInstaller, type ReleaseInstaller } from './updater';

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
let reminderPreviewTimer: ReturnType<typeof setTimeout> | null = null;
let reminderTimer: ReturnType<typeof setInterval> | null = null;
let backupTimer: ReturnType<typeof setInterval> | null = null;
let tray: Tray | null = null;
let sessionLocked = false;
let quitting = false;
// True while the Alt key is down. Windows turns Alt+F4 into a native close
// before the F4 keydown reaches the webContents listener, so the close handler
// needs it to tell an explicit quit from the X.
let altHeld = false;
let pendingNavigate: string | null = null;
const REMINDER_DEFAULT_WIDTH = 420;
const REMINDER_DEFAULT_HEIGHT = 560;
const REMINDER_MIN_WIDTH = 340;
const REMINDER_MIN_HEIGHT = 380;
const REMINDER_MAX_HEIGHT = 900;
const REMINDER_PREVIEW_DURATION = 3_000;
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

/**
 * Whether the reminders can be read while the session is locked.
 *
 * The lock exists so the agenda is not on the screen when you step away.
 * Only the level that says so out loud lets the content through.
 */
function remindersReadableWhileLocked(): boolean {
  return db.readSettings(locale()).lockLevel === 'visible';
}

function snapshot() {
  const locked = sessionLocked;
  return {
    items: locked ? [] : db.listItems(),
    groups: locked ? [] : db.listGroups(),
    settings: db.readSettings(locale()),
    locked,
    hasPassword: db.hasPassword(),
    recovery: db.recoveryNote(),
  };
}

/**
 * Whether a request from the renderer has to be refused because the session
 * is locked.
 *
 * The lock belongs to the main window, which is the one that shows the lock
 * screen. The reminder window keeps working while the session is locked in
 * soft mode, so it is not refused. Every other channel is, so a locked app
 * cannot read, change or hand out the agenda.
 */
function refusedByLock(event: Electron.IpcMainInvokeEvent): boolean {
  if (!sessionLocked) return false;
  const sender = BrowserWindow.fromWebContents(event.sender);
  if (!sender) return true;
  if (reminderWindow && !reminderWindow.isDestroyed() && sender === reminderWindow) return false;
  return true;
}

/** Throws when the request comes from the locked main window. */
function refuseWhenLocked(event: Electron.IpcMainInvokeEvent) {
  if (refusedByLock(event)) throw new Error('locked');
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
// Windows may emit a normal click around the same right-click that opens the
// tray popup. Defer the click and cancel it when the right-click wins.
let trayRightClickSeq = 0;
let lastTrayRightClickAt = 0;
let trayClickTimer: ReturnType<typeof setTimeout> | null = null;

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

function readMainWindowState(): SavedWindowBounds {
  const raw = db.getSetting('main_window_state');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SavedWindowBounds;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistMainWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) return;
  try {
    const live = mainWindow.getBounds();
    const matching = screen.getDisplayMatching(live);
    const normal = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : live;
    const resolved = resolveWindowBounds(
      { ...normal, displayId: matching.id, maximized: mainWindow.isMaximized() },
      screen.getAllDisplays(),
      screen.getPrimaryDisplay(),
    );
    db.setSetting('main_window_state', JSON.stringify({
      x: resolved.x,
      y: resolved.y,
      width: resolved.width,
      height: resolved.height,
      displayId: matching.id,
      maximized: mainWindow.isMaximized(),
    }));
  } catch (error) {
    console.error('CyberGo: could not save main window state.', error);
  }
}

function displayInfoList(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  const es = locale() === 'es';
  return [
    ...displays.filter((display) => display.id === primary.id),
    ...displays.filter((display) => display.id !== primary.id),
  ].map((display, index) => ({
    id: display.id,
    label: `${es ? 'Pantalla' : 'Display'} ${index + 1} · ${display.bounds.width}×${display.bounds.height}${display.id === primary.id ? ` (${es ? 'Principal' : 'Primary'})` : ''}`,
    isPrimary: display.id === primary.id,
    ...display.bounds,
    workArea: display.workArea,
  }));
}

function sameDisplayBounds(a: DisplayBounds | null, b: DisplayBounds): boolean {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function resolveReminderDisplay(settings: PublicSettings) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  if (settings.reminderDisplayId === -1) {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  }
  const byBounds = displays.find((display) => sameDisplayBounds(settings.reminderDisplayBounds, display.bounds));
  if (byBounds) return byBounds;
  return displays.find((display) => display.id === settings.reminderDisplayId) ?? primary;
}

function positionReminderWindow(win: BrowserWindow, settings: PublicSettings) {
  const display = resolveReminderDisplay(settings);
  const area = display.workArea || display.bounds;
  const bounds = win.getBounds();
  const marginX = 16;
  const marginY = 16;
  const positions: Record<ReminderPosition, { x: number; y: number }> = {
    'top-left': { x: area.x + marginX, y: area.y + marginY },
    'top-center': { x: area.x + Math.round((area.width - bounds.width) / 2), y: area.y + marginY },
    'top-right': { x: area.x + area.width - bounds.width - marginX, y: area.y + marginY },
    'bottom-left': { x: area.x + marginX, y: area.y + area.height - bounds.height - marginY },
    'bottom-center': { x: area.x + Math.round((area.width - bounds.width) / 2), y: area.y + area.height - bounds.height - marginY },
    'bottom-right': { x: area.x + area.width - bounds.width - marginX, y: area.y + area.height - bounds.height - marginY },
  };
  const target = positions[settings.reminderPosition] ?? positions['bottom-right'];
  const x = Math.min(area.x + Math.max(0, area.width - bounds.width), Math.max(area.x, target.x));
  const y = Math.min(area.y + Math.max(0, area.height - bounds.height), Math.max(area.y, target.y));
  win.setBounds({ ...bounds, x, y }, false);
  if (process.platform === 'win32') win.setPosition(x, y, false);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createBackup(kind: 'auto' | 'manual' | 'pre-restore'): string {
  const name = `cybergo-${kind}-${stamp()}.db`;
  // The write is deferred, so the file has to be flushed before it is copied.
  db.flush();
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
  try {
    createBackup('auto');
    db.touchAutobackup(new Date().toISOString());
    pruneBackups(settings.autobackupKeep);
  } catch (error) {
    // A backup is worth having, but not worth refusing to start over.
    console.error('CyberGo: the automatic backup could not be made.', error);
  }
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

function previewReminderItems(): Item[] {
  const now = new Date();
  const make = (id: string, title: string, offsetMinutes: number, kind: Item['kind']): Item => {
    const at = new Date(now.getTime() + offsetMinutes * 60_000).toISOString();
    return {
      id,
      kind,
      title,
      notes: '',
      allDay: false,
      startAt: at,
      endAt: null,
      importance: 'normal',
      color: '',
      groupId: null,
      recurrence: null,
      remindMinutes: 0,
      occurrenceAt: at,
      nextFireAt: at,
      snoozeUntil: null,
      alertKey: null,
      completedAt: null,
      deletedAt: null,
      remoteId: null,
      syncRev: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };
  return [
    make('preview-reminder-1', locale() === 'es' ? 'Revisar el informe semanal' : 'Review the weekly report', 20, 'task'),
    make('preview-reminder-2', locale() === 'es' ? 'Llamar a Laura' : 'Call Laura', 90, 'event'),
  ];
}

/**
 * The size the user chose, so the window opens the same way every time.
 *
 * The position does not belong here: the reminder window follows the monitor
 * and the corner that are chosen in the settings.
 */
/**
 * The size of the reminder window.
 *
 * The window fits the reminders it shows, but only until the user gives it
 * a size of their own. After that the size they chose is the one that is
 * used, and it is kept for good.
 */
function readReminderWindowSize(): { width: number; height: number; manual: boolean } {
  return resolveReminderWindowSize(db.getSetting('reminder_window_size'), {
    defaultWidth: REMINDER_DEFAULT_WIDTH,
    defaultHeight: REMINDER_DEFAULT_HEIGHT,
    minWidth: REMINDER_MIN_WIDTH,
    minHeight: REMINDER_MIN_HEIGHT,
  });
}

/** Saves the size the user chose with the drag of the border. */
function persistReminderWindowSize() {
  if (!reminderWindow || reminderWindow.isDestroyed()) return;
  try {
    const bounds = reminderWindow.getBounds();
    db.setSetting('reminder_window_size', JSON.stringify({
      width: bounds.width,
      height: bounds.height,
      manual: true,
    }));
  } catch (error) {
    console.error('CyberGo: could not save the reminder window size.', error);
  }
}

let reminderSizeTimer: ReturnType<typeof setTimeout> | null = null;
/** True once the user has given the window a size of their own. */
let reminderSizeIsManual = false;
/** The last size the process gave to the window, to tell it from a drag. */
let lastProgrammaticSize: { width: number; height: number } | null = null;
let creatingReminderWindow: Promise<void> | null = null;

async function createReminderWindow(alwaysOnTop: boolean) {
  const size = readReminderWindowSize();
  reminderSizeIsManual = size.manual;
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: REMINDER_MIN_WIDTH,
    minHeight: REMINDER_MIN_HEIGHT,
    show: false,
    frame: false,
    alwaysOnTop,
    backgroundColor: '#0c0c12',
    icon: fromPublic('icon.png'),
    webPreferences: {
      preload: path.join(here, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  reminderWindow = win;
  // The window opens with this size, so the first resize that the system
  // may report is not taken for a size of the user.
  lastProgrammaticSize = { width: size.width, height: size.height };
  lockNavigation(win);
  // A renderer that dies would leave a dead window in front of the user.
  // The list rebuilds itself from the database on reload: the items stay
  // due until they are handled, so nothing is lost.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('CyberGo: the reminder renderer died.', details.reason);
    if (details.reason !== 'clean-exit') win.webContents.reload();
  });
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    broadcast('reminder:visibility', { visible: false });
  });
  // The size is remembered once the drag of the border is over.
  win.on('resize', () => {
    // Only a drag of the border is a size of the user's own. The rest is
    // the window fitting the reminders, and it must not be remembered.
    const bounds = win.getBounds();
    if (lastProgrammaticSize
      && bounds.width === lastProgrammaticSize.width
      && bounds.height === lastProgrammaticSize.height) return;
    reminderSizeIsManual = true;
    if (reminderSizeTimer) clearTimeout(reminderSizeTimer);
    reminderSizeTimer = setTimeout(() => {
      reminderSizeTimer = null;
      persistReminderWindowSize();
    }, 400);
  });
  const dev = process.env.VITE_DEV_SERVER_URL;
  try {
    if (dev) await win.loadURL(dev + '#/reminders');
    else await win.loadFile(path.join(here, '../dist/index.html'), { hash: '/reminders' });
  } catch (error) {
    // The window could not be loaded, so it must not be kept. A broken
    // window would swallow the next reminder without a word, and the alert
    // would be lost for good.
    reminderWindow = null;
    if (!win.isDestroyed()) win.destroy();
    throw error;
  }
}

async function showReminderWindow(
  opts: { sound: boolean; pulseIds: string[]; focus?: boolean },
  preview?: { items: Item[]; settings: PublicSettings },
) {
  const activeSettings = preview?.settings ?? db.readSettings(locale());
  const always = activeSettings.reminderAlwaysOnTop;
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    // Two ticks that overlap must not build the window twice.
    if (!creatingReminderWindow) creatingReminderWindow = createReminderWindow(always);
    try {
      await creatingReminderWindow;
    } finally {
      creatingReminderWindow = null;
    }
  }
  if (!reminderWindow || reminderWindow.isDestroyed()) return;
  reminderWindow.setAlwaysOnTop(always, 'floating');
  positionReminderWindow(reminderWindow, activeSettings);
  if (reminderPreviewTimer) {
    clearTimeout(reminderPreviewTimer);
    reminderPreviewTimer = null;
  }
  if (preview) {
    reminderPreviewTimer = setTimeout(() => {
      reminderPreviewTimer = null;
      if (reminderWindow && !reminderWindow.isDestroyed()) {
        reminderWindow.hide();
        broadcast('reminder:visibility', { visible: false });
      }
    }, REMINDER_PREVIEW_DURATION);
  }
  const send = () => {
    if (!reminderWindow || reminderWindow.isDestroyed()) return;
    if (preview) reminderWindow.webContents.send('reminder:preview', preview);
    else reminderWindow.webContents.send('reminder:update', opts);
  };
  if (reminderWindow.webContents.isLoading()) {
    reminderWindow.webContents.once('did-finish-load', () => setTimeout(send, 80));
  }
  else send();
  if (opts.focus) reminderWindow.show();
  else reminderWindow.showInactive();
  positionReminderWindow(reminderWindow, activeSettings);
  // The toolbar toggle mirrors this state, so every show and every hide is
  // announced to the windows.
  broadcast('reminder:visibility', { visible: true });
}

function hideReminders() {
  if (reminderPreviewTimer) {
    clearTimeout(reminderPreviewTimer);
    reminderPreviewTimer = null;
  }
  if (reminderWindow && !reminderWindow.isDestroyed() && reminderWindow.isVisible()) {
    reminderWindow.hide();
    broadcast('reminder:visibility', { visible: false });
  }
}

/** Native Windows toast as a fallback for the floating window. Click opens reminders, buttons act directly. */
function toastFor(fresh: Item[]) {
  if (!fresh.length || !Notification.isSupported()) return;
  const settings = db.readSettings(locale());
  const es = locale() === 'es';
  // The title of a reminder is part of the agenda, so it is not written
  // where anyone can read it while the session is locked.
  const title = fresh.length === 1 && !(sessionLocked && !remindersReadableWhileLocked())
    ? fresh[0].title
    : es ? `${fresh.length} avisos pendientes` : `${fresh.length} pending reminders`;
  const note = new Notification({
    title: `CyberGo: ${title}`,
    body: es ? 'Clic para ver los avisos' : 'Click to view reminders',
    silent: !settings.soundEnabled,
    icon: fromPublic('icon.png'),
    // No actions here: Electron only delivers toast buttons on macOS, and
    // Windows ignored them, so the dismiss button never existed for the
    // user. The click opens the reminder window, where the reminder can be
    // handled.
  });
  note.on('click', () => void evaluateReminders('show'));
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
  // The alert key is stored before the window opens. Marking it afterwards
  // left a window where a second tick saw the same items as fresh and fired
  // the sound and the toast a second time.
  const previous = fresh.map((item) => ({ id: item.id, alertKey: item.alertKey }));
  if (fresh.length) db.markAlerted(fresh.map((item) => item.id));
  try {
    await showReminderWindow({
      sound: settings.soundEnabled && fresh.length > 0,
      pulseIds: fresh.map((item) => item.id),
      focus: reason === 'show',
    });
  } catch (error) {
    // The reminder could not be shown, so it has to be allowed to fire again.
    console.error('CyberGo: the reminder window could not be opened.', error);
    db.restoreAlertKeys(previous);
    return;
  }
  // The user may have locked the app while the window was loading.
  if (sessionLocked && db.readSettings(locale()).lockLevel === 'hard') {
    hideReminders();
    db.restoreAlertKeys(previous);
    return;
  }
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

function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (const b of bytes) raw += alphabet[b % alphabet.length];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Accepts both the scrypt hashes written today and the bcrypt hashes of the alpha builds. */
async function verifySecret(secret: string, stored: string | null): Promise<boolean> {
  return verifyStoredSecret(secret, stored, (value, hash) => bcrypt.compare(value, hash));
}

const AUTH_FAIL_LIMIT = 5;
const AUTH_BLOCK_MS = 30_000;

/** The lockout lives in the database, so restarting the app does not clear it. */
function failState(): { count: number; until: number } {
  return {
    count: Number(db.getSetting('auth_fail_count') || '0') || 0,
    until: Number(db.getSetting('auth_fail_until') || '0') || 0,
  };
}

function tooManyAttempts(): boolean {
  return Date.now() < failState().until;
}

function noteFailure() {
  const state = failState();
  const count = state.count + 1;
  if (count >= AUTH_FAIL_LIMIT) {
    db.setSetting('auth_fail_count', '0');
    db.setSetting('auth_fail_until', String(Date.now() + AUTH_BLOCK_MS));
    return;
  }
  db.setSetting('auth_fail_count', String(count));
}

function noteSuccess() {
  db.setSetting('auth_fail_count', '0');
  db.setSetting('auth_fail_until', '0');
}

/**
 * The renderer never navigates and never opens a window. Both are blocked
 * here so that a remote page can never end up running with the preload
 * bridge attached, which would hand it the whole database API.
 */
function lockNavigation(win: BrowserWindow) {
  win.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    const allowed = process.env.VITE_DEV_SERVER_URL
      && target.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin;
    if (allowed) return;
    event.preventDefault();
    if (target.protocol === 'https:' || target.protocol === 'http:') {
      void shell.openExternal(target.toString());
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' || target.protocol === 'http:') {
        void shell.openExternal(target.toString());
      }
    } catch {
      // Ignore anything that is not a URL we can hand to the system browser.
    }
    return { action: 'deny' };
  });
}

/**
 * The packaged app is served from a file, where response headers do not
 * apply, so index.html also carries a matching meta policy. This header
 * covers the development server.
 */
function applyContentSecurityPolicy() {
  const dev = process.env.VITE_DEV_SERVER_URL;
  // The dev server needs inline scripts for the refresh preamble, an eval
  // for the transforms and a websocket for the HMR client. The packaged
  // page has none of that: it carries a single external script and only
  // ever talks to its own files.
  const scriptSrc = dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connectSrc = dev ? "'self' ws: data: http: https:" : "'self' data:";
  const policy = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' file: blob: data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

function createMain() {
  const startup = resolveWindowBounds(
    readMainWindowState(),
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
  );
  mainWindow = new BrowserWindow({
    x: startup.x,
    y: startup.y,
    width: startup.width,
    height: startup.height,
    minWidth: MAIN_MIN_WIDTH,
    minHeight: MAIN_MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: '#0c0c12',
    icon: fromPublic('icon.png'),
    webPreferences: {
      preload: path.join(here, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  lockNavigation(mainWindow);
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistMainWindowState();
    }, 350);
  };
  mainWindow.on('close', (event) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistMainWindowState();
    // Alt+F4 arrives as a native close before its keydown: while Alt is held
    // the close is an explicit quit, so the first-close dialog and the tray
    // choice are skipped and the quit path below runs instead.
    if (altHeld) quitting = true;
    if (quitting) return;
    // The first time, the user is asked what to do when the window is
    // closed, the same way the rest of the suite does it. From then on the
    // answer is remembered and the window closes without asking again.
    if (db.getSetting('close_choice_remembered') === 'true') {
      if (db.getSetting('close_to_tray') !== 'false') {
        event.preventDefault();
        mainWindow?.hide();
        return;
      }
      // The user chose to quit, so the app goes away for good.
      quitting = true;
      setImmediate(() => app.quit());
      return;
    }
    event.preventDefault();
    // With the session locked there is nobody to answer the question, so the
    // window just goes to the tray.
    if (sessionLocked) {
      mainWindow?.hide();
      return;
    }
    showMain();
    mainWindow?.webContents.send('confirm-first-close');
  });
  mainWindow.on('move', schedulePersist);
  mainWindow.on('resize', schedulePersist);
  mainWindow.on('maximize', () => {
    persistMainWindowState();
    mainWindow?.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    persistMainWindowState();
    mainWindow?.webContents.send('window:maximized', false);
  });
  mainWindow.once('ready-to-show', () => {
    if (startup.maximized && !mainWindow?.isMaximized()) mainWindow?.maximize();
    mainWindow?.show();
  });
  // The window comes back to the screen with the tips that were open, so the
  // application is told to close them.
  const tellVisibility = (visible: boolean) => {
    mainWindow?.webContents.send('window:visibility', visible);
  };
  mainWindow.on('show', () => tellVisibility(true));
  mainWindow.on('restore', () => tellVisibility(true));
  mainWindow.on('hide', () => tellVisibility(false));
  const dev = process.env.VITE_DEV_SERVER_URL;
  // A renderer that dies must not leave a dead window behind: a reload
  // rebuilds it from the database, and the lock state lives here in the
  // main process, so it survives the renderer.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('CyberGo: the main renderer died.', details.reason);
    if (details.reason !== 'clean-exit') mainWindow?.webContents.reload();
  });
  const load = dev
    ? mainWindow.loadURL(dev)
    : mainWindow.loadFile(path.join(here, '../dist/index.html'));
  load.then(() => {
    // The window waits hidden for its first paint, and ready-to-show only
    // fires when that paint lands. When the paint never lands, the app
    // would run forever without a window, which is exactly what the user
    // sees the moment the installer closes: a stale GPU cache left behind
    // by the previous build is enough to stall it. Three seconds after the
    // load settles the window is shown anyway, and a late paint fills it
    // in.
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        console.warn('CyberGo: the main window never reported its first paint; showing it anyway.');
        mainWindow.show();
      }
    }, 3000);
  }).catch((error) => {
    // An unhandled rejection would leave an invisible window, so the
    // failure is told to the user. While developing the server may just be
    // restarting, and there the log is enough.
    console.error('CyberGo: the main window could not be loaded.', error);
    if (!dev) {
      dialog.showErrorBox('CyberGo', 'No se pudo cargar la ventana principal de CyberGo.\nThe CyberGo main window could not be loaded.');
      app.exit(1);
    }
  });
}

// =====================================
// CUSTOM TRAY MENU WINDOW (SUITE STANDARD)
// =====================================
// The tray icon itself only toggles the main window on left click. Right click
// opens a frameless HTML popup anchored to the icon bounds, following the
// CyberViewer / CyberLauncher pattern used across the suite. Menu state is
// pushed over 'tray-menu-state' and items report back through
// 'tray-menu-action'.

const SUITE_SHORT_DESCS: Record<string, { es: string; en: string }> = {
  cyberclock: { es: 'Reloj de escritorio', en: 'Desktop Clock' },
  cyberfeeds: { es: 'Lector RSS', en: 'RSS Reader' },
  cybergo: { es: 'Avisos y eventos', en: 'Events and reminders' },
  cyberlauncher: { es: 'Lanzador de apps', en: 'App Launcher' },
  cybermanager: { es: 'Administrador de tareas', en: 'Task Manager' },
  cybernotes: { es: 'Notas', en: 'Note Taking' },
  cyberpaste: { es: 'Portapapeles', en: 'Clipboard Manager' },
  cybersnap: { es: 'Captura de pantalla', en: 'Screen Capture' },
  cybertray: { es: 'Accesos directos', en: 'Shortcut Manager' },
  cyberwall: { es: 'Firewall', en: 'Firewall' },
};

// Help destinations for the tray menu; every URL points at a page that exists.
const TRAY_HELP_URLS = {
  docs: 'https://github.com/CyberGems/CyberGo/wiki',
  faq: 'https://github.com/CyberGems/CyberGo/wiki/FAQ',
  changelog: 'https://github.com/CyberGems/CyberGo/releases',
  website: 'https://cybergems.org/apps/cybergo/',
  donate: 'https://github.com/CyberGems/CyberGo#%EF%B8%8F-donate',
} as const;

// The newest published release, drafts excluded. The list is used instead of
// the /latest endpoint so pre-release builds of this app are still seen.
const RELEASES_API = 'https://api.github.com/repos/CyberGems/CyberGo/releases?per_page=5';
// The suite checks on startup and then every six hours; the result is kept
// so the About dialog opens with an answer instead of a spinner.
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
let lastUpdateCheck: { result: UpdateCheck; at: number } | null = null;
let availableInstaller: ReleaseInstaller | undefined;
const supportsInAppUpdates = app.isPackaged && process.platform === 'win32';
const updateInstaller = new UpdateInstaller(path.join(app.getPath('userData'), 'updates'), net.fetch.bind(net));

function withInstallerStatus(result: UpdateCheck): UpdateCheck {
  const installer = availableInstaller;
  if (!supportsInAppUpdates || !result.available || !installer || installer.tag !== result.latest) return result;
  return { ...result, canInstall: true, downloaded: updateInstaller.isDownloaded(installer.tag) };
}

let updateCheckInFlight: Promise<UpdateCheck> | null = null;

function runUpdateCheck(): Promise<UpdateCheck> {
  updateCheckInFlight ??= refreshUpdateCheck().finally(() => { updateCheckInFlight = null; });
  return updateCheckInFlight;
}

async function refreshUpdateCheck(): Promise<UpdateCheck> {
  const { installer, ...result } = await checkForUpdates();
  if (!result.error) availableInstaller = installer;
  lastUpdateCheck = { result, at: Date.now() };
  // The title bar badge follows every completed check, so it appears and
  // clears without waiting for the About dialog.
  const status = withInstallerStatus(result);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:status', status);
  return status;
}

/**
 * Orders CyberGo versions, tags included. Numeric parts compare as numbers,
 * the pre-release words rank in their usual order, and a version without a
 * pre-release part is newer than one that carries it.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.toLowerCase().replace(/^v/, '').match(/^([^-]+)(?:-(.*))?$/);
    return {
      nums: (match?.[1] ?? '').split('.').map((part) => Number(part) || 0),
      pres: match?.[2] ? match[2].split('.') : [],
    };
  };
  const rank = (word: string) => ({ alpha: 0, beta: 1, rc: 2 }[word] ?? 3);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if ((left.nums[i] ?? 0) !== (right.nums[i] ?? 0)) return (left.nums[i] ?? 0) > (right.nums[i] ?? 0) ? 1 : -1;
  }
  if (left.pres.length === 0 && right.pres.length === 0) return 0;
  if (left.pres.length === 0) return 1;
  if (right.pres.length === 0) return -1;
  for (let i = 0; i < Math.max(left.pres.length, right.pres.length); i += 1) {
    const wordA = left.pres[i];
    const wordB = right.pres[i];
    if (wordA === undefined) return -1;
    if (wordB === undefined) return 1;
    const numA = Number(wordA);
    const numB = Number(wordB);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      if (numA !== numB) return numA > numB ? 1 : -1;
      continue;
    }
    if (Number.isNaN(numA) !== Number.isNaN(numB)) return Number.isNaN(numA) ? -1 : 1;
    if (rank(wordA) !== rank(wordB)) return rank(wordA) > rank(wordB) ? 1 : -1;
  }
  return 0;
}

/**
 * Asks GitHub for the newest release and compares it with this build. The
 * network is only touched here, never by the renderer behind its CSP.
 */
async function checkForUpdates(): Promise<UpdateCheck & { installer?: ReleaseInstaller }> {
  try {
    const response = await net.fetch(RELEASES_API, {
      headers: { 'User-Agent': 'CyberGo-Update-Check', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { available: false, latest: null, url: null, error: `GitHub responded ${response.status}` };
    const releases = await response.json() as Array<{
      tag_name?: unknown; html_url?: unknown; draft?: unknown; assets?: unknown;
      body?: unknown; published_at?: unknown;
    } | null>;
    const release = Array.isArray(releases) ? releases.find((row) => row && typeof row.tag_name === 'string' && row.draft !== true) : null;
    if (!release || typeof release.tag_name !== 'string') return { available: false, latest: null, url: null, error: 'no-release' };
    const latest = release.tag_name;
    const available = compareVersions(latest, app.getVersion()) > 0;
    return {
      available,
      latest,
      url: typeof release.html_url === 'string' ? release.html_url : null,
      error: null,
      releaseNotes: typeof release.body === 'string' ? release.body : undefined,
      publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
      installer: available ? findReleaseInstaller(latest, release.assets) : undefined,
    };
  } catch (error) {
    return { available: false, latest: null, url: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function getSuiteAppsList(lang: 'es' | 'en') {
  try {
    const dataPath = fromPublic('suite/suite.json');
    if (fs.existsSync(dataPath)) {
      const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as {
        apps?: Array<{ slug: string; name: string; tagline?: { es?: string; en?: string }; site?: string }>;
      };
      if (raw && Array.isArray(raw.apps)) {
        return raw.apps.map((a) => ({
          slug: a.slug,
          name: a.name,
          desc: (SUITE_SHORT_DESCS[a.slug] && SUITE_SHORT_DESCS[a.slug][lang])
            || (a.tagline && a.tagline[lang])
            || a.name,
          site: a.site || `https://cybergems.org/apps/${a.slug}/`,
        }));
      }
    }
  } catch { /* fall back to the built-in list */ }
  return Object.entries(SUITE_SHORT_DESCS).map(([slug, descObj]) => ({
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    desc: descObj[lang] || descObj.en,
    site: `https://cybergems.org/apps/${slug}/`,
  }));
}

let trayMenuWin: BrowserWindow | null = null;
let trayMenuLoaded = false;
let trayMenuPrewarmTimer: ReturnType<typeof setTimeout> | null = null;
let trayMenuAnchor: Electron.Rectangle | null = null;
let trayMenuHideTimer: ReturnType<typeof setTimeout> | null = null;
let trayMenuShowPending = false;
let trayMenuShowFallback: ReturnType<typeof setTimeout> | null = null;
let trayMenuPendingGeo: Electron.Rectangle | null = null;
let trayMenuLastShown = 0;
let trayMenuOpen = false;
const TRAY_MENU_CARD_WIDTH = 292;
const TRAY_MENU_FLYOUT_WIDTH = 292;
const TRAY_MENU_FLYOUT_GAP = 4;
const TRAY_MENU_FLYOUT_SPAN = TRAY_MENU_FLYOUT_GAP + TRAY_MENU_FLYOUT_WIDTH;
const TRAY_MENU_SHADOW_PAD = 24;
const TRAY_MENU_WINDOW_WIDTH = TRAY_MENU_CARD_WIDTH + TRAY_MENU_FLYOUT_SPAN + 2 * TRAY_MENU_SHADOW_PAD;
const TRAY_MENU_EST_HEIGHT = 550;
let lastTrayMenuHeight = 550;
let mainViewHeight = 550;
let trayMenuFlyoutSide: 'left' | 'right' = 'left';
let trayMenuVerticalAlign: 'bottom' | 'top' = 'bottom';

function buildTrayMenuState(resetView: boolean) {
  const lang = locale();
  return {
    version: app.getVersion(),
    lang,
    isVisible: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()),
    shortcut: 'Alt+G',
    hasPassword: db.hasPassword(),
    suiteApps: getSuiteAppsList(lang),
    flyoutSide: trayMenuFlyoutSide,
    verticalAlign: trayMenuVerticalAlign,
    resetView: Boolean(resetView),
  };
}

function trayMenuGeometry(iconBounds: Electron.Rectangle | null, _windowW: number, windowH: number) {
  const b: { x: number; y: number; width: number; height: number } = (iconBounds && typeof iconBounds.x === 'number')
    ? { x: iconBounds.x, y: iconBounds.y, width: iconBounds.width || 0, height: iconBounds.height || 0 }
    : (() => {
      try {
        const p = screen.getCursorScreenPoint();
        return { x: p.x, y: p.y, width: 0, height: 0 };
      } catch {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
    })();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  let display: Electron.Display;
  try {
    display = screen.getDisplayNearestPoint({ x: cx, y: cy });
  } catch {
    display = screen.getPrimaryDisplay();
  }
  const work = (display && display.workArea) || { x: 0, y: 0, width: TRAY_MENU_WINDOW_WIDTH, height: windowH };

  const gap = 4;
  const pad = TRAY_MENU_SHADOW_PAD;
  const cardW = TRAY_MENU_CARD_WIDTH;
  const cardH = windowH - 2 * pad;

  let cardX: number;
  let cardY: number;
  let verticalAlign: 'bottom' | 'top' = 'bottom';
  const dLeft = cx - work.x;
  const dRight = (work.x + work.width) - cx;
  const dTop = cy - work.y;
  const dBottom = (work.y + work.height) - cy;

  if (dBottom <= dLeft && dBottom <= dRight && dBottom <= dTop) {
    cardX = cx - cardW / 2;
    cardY = b.y - gap - cardH;
    verticalAlign = 'bottom';
  } else if (dTop <= dLeft && dTop <= dRight) {
    cardX = cx - cardW / 2;
    cardY = b.y + b.height + gap;
    verticalAlign = 'top';
  } else if (dLeft <= dRight) {
    cardX = b.x + b.width + gap;
    cardY = cy - cardH / 2;
    verticalAlign = 'bottom';
  } else {
    cardX = b.x - gap - cardW;
    cardY = cy - cardH / 2;
    verticalAlign = 'bottom';
  }

  cardX = Math.min(Math.max(cardX, work.x + 4), work.x + work.width - cardW - 4);
  cardY = Math.min(Math.max(cardY, work.y + 4), work.y + work.height - cardH - 4);

  const spaceLeft = cardX - work.x;
  const spaceRight = (work.x + work.width) - (cardX + cardW);
  const preferLeft = cx >= work.x + work.width / 2;
  const flyoutSide: 'left' | 'right' = preferLeft
    ? ((spaceLeft >= TRAY_MENU_FLYOUT_SPAN || spaceLeft >= spaceRight) ? 'left' : 'right')
    : ((spaceRight >= TRAY_MENU_FLYOUT_SPAN || spaceRight >= spaceLeft) ? 'right' : 'left');

  const mainWindowX = cardX - pad;
  const rawWindowX = flyoutSide === 'left' ? mainWindowX - TRAY_MENU_FLYOUT_SPAN : mainWindowX;
  const minWindowX = work.x - pad;
  const maxWindowX = Math.max(minWindowX, work.x + work.width + pad - TRAY_MENU_WINDOW_WIDTH);
  const windowX = Math.min(Math.max(rawWindowX, minWindowX), maxWindowX);
  const minWindowY = work.y - pad;
  const maxWindowY = Math.max(minWindowY, work.y + work.height + pad - windowH);
  const windowY = Math.min(Math.max(cardY - pad, minWindowY), maxWindowY);

  trayMenuFlyoutSide = flyoutSide;
  trayMenuVerticalAlign = verticalAlign;

  return { x: Math.round(windowX), y: Math.round(windowY), width: Math.round(TRAY_MENU_WINDOW_WIDTH), height: Math.round(windowH) };
}

function ensureTrayMenuWin(): BrowserWindow {
  if (trayMenuWin && !trayMenuWin.isDestroyed()) return trayMenuWin;

  trayMenuLoaded = false;
  const windowW = TRAY_MENU_WINDOW_WIDTH;
  const win = new BrowserWindow({
    width: windowW,
    height: TRAY_MENU_EST_HEIGHT,
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: fromPublic('tray/tray-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  trayMenuWin = win;
  // The tray menu is as locked down as the other windows: it never
  // navigates and never opens windows, and its preload only bridges IPC,
  // so it runs sandboxed like the rest.
  lockNavigation(win);

  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.loadFile(fromPublic('tray/tray-menu.html')).catch((error) => {
    // A menu that did not load would stay dead for every later click, so
    // the window is dropped and the next one that opens is built again.
    console.error('CyberGo: the tray menu could not be loaded.', error);
    if (!win.isDestroyed()) win.destroy();
  });

  win.on('blur', () => {
    if (trayMenuHideTimer) return;
    if (Date.now() - trayMenuLastShown < 250) return;
    trayMenuHideTimer = setTimeout(() => {
      trayMenuHideTimer = null;
      hideCustomTrayMenu();
    }, 120);
  });

  win.on('closed', () => {
    if (trayMenuWin === win) {
      trayMenuWin = null;
      trayMenuLoaded = false;
      trayMenuOpen = false;
    }
  });

  win.webContents.on('preload-error', (_e, pPath, error) => {
    console.error('[TRAY-PRELOAD-ERROR]', pPath, error);
  });

  win.webContents.once('did-finish-load', () => {
    if (trayMenuWin !== win || win.isDestroyed()) return;
    trayMenuLoaded = true;
    win.webContents.send('tray-menu-state', { ...buildTrayMenuState(true), prepareReveal: trayMenuShowPending });
  });

  return win;
}

function schedulePrewarmTrayMenuWin(): void {
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null; }
  if (quitting || !tray || tray.isDestroyed()) return;
  trayMenuPrewarmTimer = setTimeout(() => {
    trayMenuPrewarmTimer = null;
    if (quitting || !tray || tray.isDestroyed() || trayMenuWin) return;
    try { ensureTrayMenuWin(); } catch { /* ignore */ }
  }, 80);
}

function resolveTrayAnchor(eventBounds?: Electron.Rectangle): Electron.Rectangle {
  let cursor: { x: number; y: number } | null = null;
  try { cursor = screen.getCursorScreenPoint(); } catch { cursor = null; }
  const nearCursor = (r: Electron.Rectangle): boolean => {
    if (!cursor) return true;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    return Math.abs(cx - cursor.x) <= 80 && Math.abs(cy - cursor.y) <= 80;
  };
  if (eventBounds && (eventBounds.width || eventBounds.height) && nearCursor(eventBounds)) {
    return eventBounds;
  }
  try {
    const tb = tray?.getBounds();
    if (tb && (tb.width > 0 || tb.height > 0) && nearCursor(tb)) return tb;
  } catch { /* ignore */ }
  return cursor ? { x: cursor.x, y: cursor.y, width: 0, height: 0 } : { x: 0, y: 0, width: 0, height: 0 };
}

function boundsClose(a: Electron.Rectangle, b: Electron.Rectangle, tol = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.width - b.width) <= tol &&
    Math.abs(a.height - b.height) <= tol
  );
}

function applyTrayBounds(win: BrowserWindow, geo: Electron.Rectangle): void {
  try {
    const before = win.getBounds();
    if (boundsClose(before, geo)) return;
    win.setBounds(geo, false);
    const after = win.getBounds();
    if (!boundsClose(after, geo)) {
      win.setBounds(geo, false);
    }
  } catch { /* ignore */ }
}

function revealTrayMenuWin() {
  if (!trayMenuWin || trayMenuWin.isDestroyed()) return;
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null; }
  trayMenuShowPending = false;
  if (trayMenuPendingGeo) {
    applyTrayBounds(trayMenuWin, trayMenuPendingGeo);
  }
  trayMenuLastShown = Date.now();
  if (!trayMenuWin.isVisible()) {
    trayMenuWin.show();
  }
  trayMenuWin.focus();
  try {
    trayMenuWin.webContents.send('tray-menu-show');
  } catch { /* ignore */ }
}

function showCustomTrayMenu(eventBounds?: Electron.Rectangle) {
  if (!tray || tray.isDestroyed()) return;
  if (trayMenuHideTimer) { clearTimeout(trayMenuHideTimer); trayMenuHideTimer = null; }
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null; }
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null; }

  // Never reuse a previously shown/hidden BrowserWindow: Chromium on Windows
  // suspends Viz while hidden and retains/evicts stale DirectComposition frames
  // across hide->show, causing 2nd-click flicker and cross-monitor side jumps.
  if (trayMenuWin && !trayMenuWin.isDestroyed() && trayMenuWin.isVisible()) {
    const stale = trayMenuWin;
    trayMenuWin = null;
    trayMenuLoaded = false;
    try { stale.destroy(); } catch { /* ignore */ }
  }

  trayMenuAnchor = resolveTrayAnchor(eventBounds);
  const windowW = TRAY_MENU_WINDOW_WIDTH;
  const initialH = mainViewHeight || lastTrayMenuHeight || TRAY_MENU_EST_HEIGHT;
  const geo = trayMenuGeometry(trayMenuAnchor, windowW, initialH);

  const w = ensureTrayMenuWin();
  if (!w || w.isDestroyed()) return;

  trayMenuOpen = true;
  applyTrayBounds(w, geo);
  trayMenuPendingGeo = geo;

  trayMenuShowPending = true;
  trayMenuShowFallback = setTimeout(() => {
    trayMenuShowFallback = null;
    if (trayMenuShowPending) revealTrayMenuWin();
  }, 450);

  if (trayMenuLoaded) {
    w.webContents.send('tray-menu-state', { ...buildTrayMenuState(true), prepareReveal: true });
  }
}

function hideCustomTrayMenu() {
  if (trayMenuHideTimer) { clearTimeout(trayMenuHideTimer); trayMenuHideTimer = null; }
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null; }
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null; }
  trayMenuShowPending = false;
  trayMenuPendingGeo = null;
  trayMenuOpen = false;
  const win = trayMenuWin;
  trayMenuWin = null;
  trayMenuLoaded = false;
  if (win && !win.isDestroyed()) {
    try { win.destroy(); } catch { /* ignore */ }
  }
  schedulePrewarmTrayMenuWin();
}

function updateCustomTrayMenuState() {
  if (trayMenuWin && !trayMenuWin.isDestroyed()) {
    trayMenuWin.webContents.send('tray-menu-state', buildTrayMenuState(false));
  }
}

const CYBERGO_TOGGLE_SHORTCUT = 'Alt+G';

function createTray() {
  const image = nativeImage.createFromPath(fromPublic('tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip(formatTrayTooltip(CYBERGO_TOGGLE_SHORTCUT));
  try {
    ensureTrayMenuWin();
  } catch (err) {
    console.warn('[TRAY] Failed to prewarm tray menu window:', err instanceof Error ? err.message : err);
  }

  if (process.platform === 'win32') {
    tray.on('right-click', (_event, bounds) => {
      trayRightClickSeq += 1;
      lastTrayRightClickAt = Date.now();
      if (trayMenuOpen && trayMenuWin && !trayMenuWin.isDestroyed() && trayMenuWin.isVisible()) {
        hideCustomTrayMenu();
      } else {
        showCustomTrayMenu(bounds);
      }
    });
  }

  tray.on('click', () => {
    // If the popup is open, closing it is the whole action; do not also toggle
    // the main window underneath.
    const menuWasOpen = trayMenuOpen;
    hideCustomTrayMenu();
    if (process.platform === 'win32') {
      const clickSeq = trayRightClickSeq;
      if (trayClickTimer) clearTimeout(trayClickTimer);
      trayClickTimer = setTimeout(() => {
        trayClickTimer = null;
        if (menuWasOpen) return;
        if (trayRightClickSeq !== clickSeq || Date.now() - lastTrayRightClickAt < 400) return;
        if (trayMenuOpen) return;
        toggleMainFromTray();
      }, 120);
      return;
    }
    if (menuWasOpen) return;
    toggleMainFromTray();
  });

  tray.on('double-click', () => {
    hideCustomTrayMenu();
    showMain();
  });
}

// IPC for the custom tray menu window.
ipcMain.on('tray-menu-action', (_event, action: string, payload?: { site?: string }) => {
  hideCustomTrayMenu();

  if (action === 'quit') {
    quitting = true;
    app.quit();
    return;
  }
  if (action === 'show') {
    showMain();
    return;
  }
  if (action === 'hide') {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    return;
  }
  if (action === 'quick-capture') {
    quickCapture();
    return;
  }
  if (action === 'about') {
    showMain();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('open-about');
    return;
  }
  if (action === 'reminders') {
    void evaluateReminders('show');
    return;
  }
  if (action === 'lock') {
    if (db.hasPassword()) {
      sessionLocked = true;
      hideReminders();
      changed();
      showMain();
    }
    return;
  }
  if (action === 'suite-app' && payload && payload.site) {
    // The payload crosses the sandbox, so it is not trusted: only web URLs
    // reach the system browser, the same rule the shell channel applies.
    try {
      const site = new URL(String(payload.site));
      if (site.protocol === 'https:' || site.protocol === 'http:') {
        void shell.openExternal(site.toString());
      }
    } catch {
      // Anything that is not a URL is dropped.
    }
    return;
  }
  if (action === 'suite-view-all') {
    void shell.openExternal('https://cybergems.org/#apps');
    return;
  }
  if (action === 'suite-home') {
    void shell.openExternal('https://cybergems.org');
    return;
  }
  if (action === 'help-docs') {
    void shell.openExternal(TRAY_HELP_URLS.docs);
    return;
  }
  if (action === 'help-faq') {
    void shell.openExternal(TRAY_HELP_URLS.faq);
    return;
  }
  if (action === 'help-changelog') {
    void shell.openExternal(TRAY_HELP_URLS.changelog);
    return;
  }
  if (action === 'help-website') {
    void shell.openExternal(TRAY_HELP_URLS.website);
    return;
  }
  if (action === 'help-donate') {
    void shell.openExternal(TRAY_HELP_URLS.donate);
    return;
  }
});

ipcMain.on('tray-menu-hide', () => {
  hideCustomTrayMenu();
});

ipcMain.on('tray-menu-ready', (event, rect: { height: number; view?: string; prepared?: boolean }) => {
  if (!trayMenuWin || trayMenuWin.isDestroyed() || event.sender !== trayMenuWin.webContents) return;
  if (rect && rect.height) {
    const windowW = TRAY_MENU_WINDOW_WIDTH;
    const isMain = rect.view === 'main' || !rect.view;
    const desiredH = isMain
      ? Math.min(Math.max(rect.height, 350), 750)
      : Math.min(Math.max(rect.height, mainViewHeight), 750);
    if (isMain) {
      mainViewHeight = desiredH;
      lastTrayMenuHeight = desiredH;
    }
    if (trayMenuAnchor) {
      const geo = trayMenuGeometry(trayMenuAnchor, windowW, desiredH);
      trayMenuPendingGeo = geo;
      if (trayMenuShowPending && rect.prepared) {
        revealTrayMenuWin();
        return;
      }
      if (trayMenuWin.isVisible()) {
        applyTrayBounds(trayMenuWin, geo);
      }
    }
  } else if (trayMenuShowPending && rect?.prepared) {
    revealTrayMenuWin();
  }
});

ipcMain.on('tray-menu-request-state', (event) => {
  event.reply('tray-menu-state', buildTrayMenuState(false));
});

function registerIpc() {
  ipcMain.handle('bootstrap:get', () => snapshot());
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron || '',
    chrome: process.versions.chrome || '',
    node: process.versions.node || '',
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
  }));
  ipcMain.handle('updates:check', (_event, force?: unknown) => {
    if (force === true) return runUpdateCheck();
    if (lastUpdateCheck && Date.now() - lastUpdateCheck.at < UPDATE_CHECK_INTERVAL) {
      return withInstallerStatus(lastUpdateCheck.result);
    }
    return runUpdateCheck();
  });
  ipcMain.handle('updates:download', async (event, tag: unknown): Promise<UpdateDownloadResult> => {
    const installer = availableInstaller;
    if (!supportsInAppUpdates || event.sender !== mainWindow?.webContents || !installer || installer.tag !== tag) {
      return 'failed';
    }
    try {
      await updateInstaller.download(installer, (percent) => {
        if (!event.sender.isDestroyed()) event.sender.send('updates:progress', installer.tag, percent);
      });
      return 'ready';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      console.error('CyberGo update download failed:', error);
      return 'failed';
    }
  });
  ipcMain.handle('updates:cancel', (event, tag: unknown) =>
    event.sender === mainWindow?.webContents && typeof tag === 'string' && updateInstaller.cancelDownload(tag));
  ipcMain.handle('updates:install', async (event, tag: unknown) => {
    if (!supportsInAppUpdates || event.sender !== mainWindow?.webContents || typeof tag !== 'string') {
      return { ok: false, downloaded: false };
    }
    try {
      await updateInstaller.install(tag);
      setImmediate(() => app.quit());
      return { ok: true, downloaded: true };
    } catch (error) {
      console.error('CyberGo update installer failed:', error);
      return { ok: false, downloaded: updateInstaller.isDownloaded(tag) };
    }
  });
  ipcMain.handle('shell:open-external', async (_event, value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
      await shell.openExternal(url.toString());
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('clipboard:read-text', () => {
    try {
      return clipboard.readText();
    } catch {
      return '';
    }
  });
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

  ipcMain.handle('items:save', (e, draft: unknown) => {
    refuseWhenLocked(e);
    const clean = asDraft(draft);
    if (!clean) throw new Error('invalid draft');
    const item = db.saveItem(clean);
    changed();
    void evaluateReminders('tick');
    return item;
  });
  ipcMain.handle('items:delete', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.softDelete(clean);
    changed();
  });
  ipcMain.handle('items:restore', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.restoreItem(clean);
    changed();
  });
  ipcMain.handle('items:purge', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.purgeItem(clean);
    changed();
  });
  ipcMain.handle('items:empty-trash', (e) => { refuseWhenLocked(e); db.emptyTrash(); changed(); });
  /**
   * What the user chose when the window was closed.
   *
   * The window can go to the tray and stay in the background, or the app can
   * quit for good. The choice is only remembered when the user asks for it.
   */
  ipcMain.handle('first-close-choice', (e, action: unknown, remember: unknown) => {
    refuseWhenLocked(e);
    const choice = action === 'tray' ? 'tray' : action === 'quit' ? 'quit' : null;
    if (!choice) return false;
    if (remember === true) {
      db.setSetting('close_choice_remembered', 'true');
      db.setSetting('close_to_tray', choice === 'tray' ? 'true' : 'false');
    }
    if (choice === 'tray') {
      mainWindow?.hide();
      return true;
    }
    quitting = true;
    app.quit();
    return true;
  });
  ipcMain.handle('items:complete', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.completeItem(clean);
    changed();
  });
  ipcMain.handle('groups:save', (e, input: unknown) => {
    refuseWhenLocked(e);
    if (!input || typeof input !== 'object') throw new Error('invalid group');
    const raw = input as Record<string, unknown>;
    const name = asText(raw.name, 120);
    if (name == null) throw new Error('invalid group');
    let groupId: string | undefined;
    if (raw.id != null) {
      const parsed = asId(raw.id);
      if (!parsed) throw new Error('invalid group');
      groupId = parsed;
    }
    const group = db.saveGroup({
      id: groupId,
      name,
      color: asText(raw.color, 32) ?? '',
    });
    changed();
    return group;
  });
  ipcMain.handle('groups:delete', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.deleteGroup(clean);
    changed();
  });

  ipcMain.handle('settings:patch', (e, patch: unknown) => {
    refuseWhenLocked(e);
    // The patch crosses the sandbox, so it is checked like every other
    // payload: invalid fields are dropped instead of persisted.
    const clean = asSettingsPatch(patch);
    if (!clean || Object.keys(clean).length === 0) return db.readSettings(locale());
    db.applySettingsPatch(clean);
    if (clean.openAtLogin != null) applyLogin(clean.openAtLogin);
    if (clean.reminderAlwaysOnTop != null && reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.setAlwaysOnTop(clean.reminderAlwaysOnTop, 'floating');
    }
    if (
      (clean.reminderDisplayId != null || clean.reminderDisplayBounds !== undefined || clean.reminderPosition != null)
      && reminderWindow
      && !reminderWindow.isDestroyed()
    ) {
      positionReminderWindow(reminderWindow, db.readSettings(locale()));
    }
    if (clean.lockLevel === 'hard' && sessionLocked) hideReminders();
    if (clean.lockLevel === 'soft' && sessionLocked) void evaluateReminders('tick');
    changed();
    return db.readSettings(locale());
  });

  ipcMain.handle('auth:set', async (e, password: unknown, hint: unknown, method: unknown) => {
    refuseWhenLocked(e);
    if (db.hasPassword()) return { ok: false as const, error: 'exists' };
    const mode = methodOf(method);
    const secret = normalizeAuthSecret(presented(password, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const code = recoveryCode();
    db.setPasswordHash(await hashSecret(secret));
    db.setRecoveryHash(await hashSecret(code.replace('-', '')));
    db.setAuthMethod(mode);
    db.applySettingsPatch({ passwordHint: asText(hint, 200) ?? '', lockOnLaunch: true });
    changed();
    return { ok: true as const, recoveryCode: code };
  });
  ipcMain.handle('auth:change', async (e, current: unknown, next: unknown, hint: unknown, method: unknown) => {
    refuseWhenLocked(e);
    if (tooManyAttempts()) return { ok: false as const, error: 'wait' };
    const stored = db.authMethod();
    if (!(await verifySecret(presented(current, stored), db.passwordHash()))) {
      noteFailure();
      return { ok: false as const, error: 'wrong' };
    }
    const mode = methodOf(method);
    const secret = normalizeAuthSecret(presented(next, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const code = recoveryCode();
    db.setPasswordHash(await hashSecret(secret));
    db.setRecoveryHash(await hashSecret(code.replace('-', '')));
    db.setAuthMethod(mode);
    db.applySettingsPatch({ passwordHint: asText(hint, 200) ?? '' });
    noteSuccess();
    changed();
    return { ok: true as const, recoveryCode: code };
  });
  ipcMain.handle('auth:remove', async (e, current: unknown) => {
    refuseWhenLocked(e);
    if (tooManyAttempts()) return false;
    const stored = db.authMethod();
    if (!(await verifySecret(presented(current, stored), db.passwordHash()))) {
      noteFailure();
      return false;
    }
    db.clearAuth();
    sessionLocked = false;
    noteSuccess();
    changed();
    return true;
  });
  ipcMain.handle('auth:unlock', async (_e, password: unknown) => {
    if (tooManyAttempts()) {
      db.recordAccessEvent('blocked', db.authMethod());
      return 'wait';
    }
    if (!db.passwordHash()) {
      sessionLocked = false;
      return 'ok';
    }
    const stored = db.authMethod();
    if (!(await verifySecret(presented(password, stored), db.passwordHash()))) {
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
  ipcMain.handle('auth:recover', async (_e, code: unknown, next: unknown, method: unknown) => {
    if (tooManyAttempts()) {
      db.recordAccessEvent('blocked', 'recovery');
      return { ok: false as const, error: 'wait' };
    }
    const normalized = typeof code === 'string' ? code.trim().toUpperCase().replace(/-/g, '') : '';
    if (!(await verifySecret(normalized, db.recoveryHash()))) {
      noteFailure();
      db.recordAccessEvent('recovery-failure', 'recovery');
      return { ok: false as const, error: 'wrong' };
    }
    const mode = method === undefined ? db.authMethod() : methodOf(method);
    const secret = normalizeAuthSecret(presented(next, mode), mode);
    if (!secret) return { ok: false as const, error: mode === 'pin' ? 'pin' : 'short' };
    const fresh = recoveryCode();
    db.setPasswordHash(await hashSecret(secret));
    db.setRecoveryHash(await hashSecret(fresh.replace('-', '')));
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

  ipcMain.handle('access-log:list', (e) => { refuseWhenLocked(e); return db.listAccessLog(); });
  ipcMain.handle('access-log:clear', (e) => {
    refuseWhenLocked(e);
    db.clearAccessLog();
    changed();
  });

  ipcMain.handle('displays:list', () => displayInfoList());
  ipcMain.handle(
    'reminders:preview',
    async (
      _e,
      placement: Partial<Pick<PublicSettings, 'reminderDisplayId' | 'reminderDisplayBounds' | 'reminderPosition'>> = {},
    ) => {
      const settings = db.readSettings(locale());
      const previewSettings: PublicSettings = {
        ...settings,
        reminderDisplayId: Number.isFinite(placement.reminderDisplayId) ? Math.trunc(placement.reminderDisplayId as number) : settings.reminderDisplayId,
        reminderDisplayBounds: placement.reminderDisplayBounds ?? settings.reminderDisplayBounds,
        reminderPosition: placement.reminderPosition ?? settings.reminderPosition,
      };
      await showReminderWindow(
        { sound: false, pulseIds: [], focus: true },
        { items: previewReminderItems(), settings: previewSettings },
      );
      return true;
    },
  );

  // While the session is locked the item list must not cross the bridge to
  // the main window. The reminder window keeps it in soft mode, which is
  // the whole point of the soft lock.
  ipcMain.handle('reminders:due', (e) => {
    if (sessionLocked) {
      // The content of the reminders does not cross the bridge while the
      // session is locked, unless the level says it may.
      if (!remindersReadableWhileLocked()) return [];
      if (refusedByLock(e)) return [];
    }
    return db.listItems().filter((item) => isDue(item, Date.now()));
  });
  ipcMain.handle('reminders:show', () => evaluateReminders('show'));
  ipcMain.handle('reminders:toggle', async () => {
    const isVisible = (): boolean => !!reminderWindow && !reminderWindow.isDestroyed() && reminderWindow.isVisible();
    if (isVisible()) {
      hideReminders();
      return { visible: false };
    }
    await evaluateReminders('show');
    return { visible: isVisible() };
  });
  ipcMain.handle('reminders:fit-window', (_e, height: unknown) => {
    if (!reminderWindow || reminderWindow.isDestroyed()) return false;
    // El tamaño que eligió el usuario no se toca nunca.
    if (reminderSizeIsManual) return false;
    const wanted = Math.round(Number(height));
    if (!Number.isFinite(wanted) || wanted <= 0) return false;
    const settings = db.readSettings(locale());
    const display = resolveReminderDisplay(settings);
    const area = display.workArea || display.bounds;
    // The window cannot be taller than the screen it lives on.
    const ceiling = Math.max(REMINDER_MIN_HEIGHT, Math.min(REMINDER_MAX_HEIGHT, area.height - 32));
    const next = Math.max(REMINDER_MIN_HEIGHT, Math.min(ceiling, wanted));
    const bounds = reminderWindow.getBounds();
    if (Math.abs(bounds.height - next) < 2) return false;
    reminderWindow.setSize(bounds.width, next);
    lastProgrammaticSize = { width: bounds.width, height: next };
    positionReminderWindow(reminderWindow, settings);
    return true;
  });
  ipcMain.handle('reminders:snooze', (e, id: unknown, minutes: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    const amount = asNumber(minutes);
    if (!clean || amount == null) return;
    db.snoozeMinutes(clean, Math.max(1, Math.floor(amount)));
    afterReminderChange();
  });
  ipcMain.handle('reminders:snooze-until', (e, id: unknown, iso: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    const until = asIsoDate(iso);
    if (!clean || !until) return;
    db.snoozeItem(clean, until);
    afterReminderChange();
  });
  ipcMain.handle('reminders:tomorrow', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.snoozeItem(clean, tomorrowAtNine());
    afterReminderChange();
  });
  ipcMain.handle('reminders:dismiss', (e, id: unknown) => {
    refuseWhenLocked(e);
    const clean = asId(id);
    if (!clean) return;
    db.dismissItem(clean);
    afterReminderChange();
  });
  ipcMain.handle('reminders:dismiss-all', (e) => {
    refuseWhenLocked(e);
    for (const item of db.listItems().filter((row) => isDue(row, Date.now()))) db.dismissItem(item.id);
    afterReminderChange();
  });
  ipcMain.handle('reminders:always-on-top', (e, value: unknown) => {
    refuseWhenLocked(e);
    db.applySettingsPatch({ reminderAlwaysOnTop: value === true });
    if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.setAlwaysOnTop(value === true, 'floating');
    changed();
  });
  ipcMain.handle('reminders:open-item', (_e, id: unknown) => {
    const clean = asId(id);
    if (!clean) return;
    pendingNavigate = clean;
    showMain();
    if (!sessionLocked) flushNavigate();
  });
  ipcMain.handle('sound:path', () => soundFile());
  ipcMain.handle('sound:pick', async (e) => {
    refuseWhenLocked(e);
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
  ipcMain.handle('sound:clear', (e) => {
    refuseWhenLocked(e);
    db.applySettingsPatch({ soundPath: '' });
    changed();
  });

  ipcMain.handle('backup:now', (e) => {
    refuseWhenLocked(e);
    db.flush();
    const name = createBackup('manual');
    pruneBackups(db.readSettings(locale()).autobackupKeep);
    return name;
  });
  ipcMain.handle('backup:list', (e) => { refuseWhenLocked(e); return listBackups(); });
  ipcMain.handle('backup:restore', (e, name: unknown) => {
    refuseWhenLocked(e);
    if (typeof name !== 'string') return false;
    const safe = path.basename(name);
    if (!safe) return false;
    const source = path.join(backupsDir(), safe);
    if (!fs.existsSync(source)) return false;
    db.flush();
    createBackup('pre-restore');
    const target = db.databasePath();
    const staged = `${target}.restore`;
    // The copy is staged and renamed so a failure cannot leave a half written
    // database behind.
    try {
      fs.copyFileSync(source, staged);
    } catch (error) {
      console.error('CyberGo: could not stage the backup.', error);
      return false;
    }
    // The copy is opened before it replaces anything. A damaged backup used
    // to replace the live file, and the app was left without a database.
    if (!db.canOpenFile(staged)) {
      console.error('CyberGo: the backup could not be opened, the current database is kept.');
      try {
        fs.unlinkSync(staged);
      } catch {
        // Nothing else to clean up.
      }
      return false;
    }
    try {
      fs.renameSync(staged, target);
    } catch (error) {
      console.error('CyberGo: could not restore the backup.', error);
      try {
        if (fs.existsSync(staged)) fs.unlinkSync(staged);
      } catch {
        // Nothing else to clean up.
      }
      return false;
    }
    if (!db.reloadFromDisk()) {
      console.error('CyberGo: the restored database could not be opened, keeping the current one.');
      return false;
    }
    sessionLocked = db.hasPassword() && db.readSettings(locale()).lockOnLaunch;
    changed();
    return true;
  });
  ipcMain.handle('data:open-folder', (e) => { refuseWhenLocked(e); return shell.openPath(app.getPath('userData')); });
  ipcMain.handle('csv:export', async (e) => {
    refuseWhenLocked(e);
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
    try {
      fs.writeFileSync(result.filePath, `\uFEFF${csv}`, 'utf8');
    } catch (error) {
      console.error('CyberGo: could not write the CSV file.', error);
      return false;
    }
    return true;
  });
  ipcMain.handle('csv:import', async (e) => {
    refuseWhenLocked(e);
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
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    let text: string;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      return { added: 0, total: 0, fileName, format: 'unknown' as const, errors: ['read'] };
    }
    const rows = parseCsv(text);
    const format = detectCsvFormat(rows);
    if (format === 'unknown') {
      return { added: 0, total: rows.length, fileName, format, errors: ['unsupported headers'] };
    }
    const errors: string[] = [];
    let added = 0;
    // The group list is read once instead of once per row, and the groups
    // created along the way are added to it so two rows naming the same new
    // group do not create it twice.
    const groups = db.listGroups();
    rows.forEach((row, index) => {
      try {
        const { draft, newGroupName } = rowToDraft(row, groups);
        if (newGroupName) {
          const group = db.saveGroup({ name: newGroupName, color: '#6c63e6' });
          draft.groupId = group.id;
          groups.push(group);
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
    if (added) {
      db.flush();
      changed();
      void evaluateReminders('tick');
    }
    return { added, total: rows.length, fileName, format, errors };
  });
  ipcMain.handle('ics:import', async (e) => {
    refuseWhenLocked(e);
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
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    let text: string;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      return { added: 0, total: 0, fileName, format: 'ics' as const, errors: ['read'] };
    }
    let parsed;
    try {
      parsed = parseIcs(text);
    } catch (error) {
      return { added: 0, total: 0, fileName, format: 'ics' as const, errors: [error instanceof Error ? error.message : 'invalid'] };
    }
    const errors: string[] = [...parsed.errors];
    let added = 0;
    parsed.events.forEach(({ draft, number }) => {
      try {
        db.saveItem(draft);
        added += 1;
      } catch (error) {
        // The number is the one of the event in the file, so the two series
        // of messages point at the same place.
        errors.push(`event ${number}: ${error instanceof Error ? error.message : 'invalid'}`);
      }
    });
    if (added) {
      changed();
      void evaluateReminders('tick');
      db.flush();
    }
    return { added, total: parsed.events.length, fileName, format: 'ics' as const, errors };
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
    applyContentSecurityPolicy();
    await db.initDatabase(path.join(app.getPath('userData'), 'cybergo.db'), wasmPath(), locale());
    if (verify) db.seedDemoIfEmpty();
    const settings = db.readSettings(locale());
    applyLogin(settings.openAtLogin);
    sessionLocked = db.hasPassword() && settings.lockOnLaunch;
    maybeAutoBackup();
    registerIpc();
    createMain();
    createTray();
    if (!globalShortcut.register('Alt+G', () => quickCapture())) {
      console.error('CyberGo: could not register the Alt+G quick-capture hotkey.');
    }
    setTimeout(() => void evaluateReminders('tick'), 800);
    reminderTimer = setInterval(() => void evaluateReminders('tick'), 15_000);
    backupTimer = setInterval(() => maybeAutoBackup(), 60 * 60 * 1000);
    // The silent update checks: one shortly after the start, then every six
    // hours. A failure just leaves the cache empty, never bothers the user.
    setTimeout(() => { void runUpdateCheck().catch(() => {}); }, 20_000);
    setInterval(() => { void runUpdateCheck().catch(() => {}); }, UPDATE_CHECK_INTERVAL);
    if (verify && mainWindow) {
      bootLog('verify hook');
      // The screenshots go to the temporary folder, never into whatever
      // directory the app happened to be started from.
      const shots = path.join(os.tmpdir(), 'cybergo-verify');
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(async () => {
          fs.mkdirSync(shots, { recursive: true });
          const shot = await mainWindow?.capturePage();
          if (shot) fs.writeFileSync(path.join(shots, 'boot-main.png'), shot.toPNG());
          await evaluateReminders('show');
          setTimeout(async () => {
            const shot2 = await reminderWindow?.capturePage();
            if (shot2) fs.writeFileSync(path.join(shots, 'boot-reminders.png'), shot2.toPNG());
            quitting = true;
            app.quit();
          }, 900);
        }, 900);
      });
    }
  }).catch((error: unknown) => {
    const text = error instanceof Error ? error.stack || error.message : String(error);
    try {
      fs.appendFileSync(path.join(os.tmpdir(), 'cybergo-boot.txt'), `${new Date().toISOString()} ${text}\n`);
    } catch {
      // The log is best effort, the dialog below is the real report.
    }
    // A silent exit looks like a double click that did nothing, so the
    // cause is told to the user. Both languages, because the settings that
    // carry the language may not be readable at this point.
    dialog.showErrorBox('CyberGo', `CyberGo no pudo iniciarse / CyberGo could not start:\n\n${text.slice(0, 600)}`);
    app.exit(1);
  });
}

app.on('window-all-closed', () => {
  if (quitting) app.quit();
});

app.on('before-quit', () => {
  persistMainWindowState();
  db.flush();
  quitting = true;
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null; }
});

app.on('will-quit', () => {
  // The timers would keep running against a closed database.
  if (reminderTimer) clearInterval(reminderTimer);
  if (backupTimer) clearInterval(backupTimer);
  reminderTimer = null;
  backupTimer = null;
  globalShortcut.unregisterAll();
  db.close();
});

// The writes are deferred, so an unexpected failure has to reach the disk
// before the process goes away.
process.on('uncaughtException', (error) => {
  console.error('CyberGo: unexpected failure.', error);
  try {
    db.flush();
  } catch {
    // Nothing else can be done at this point.
  }
});

// A rejected promise that nobody waits for would otherwise disappear
// without a word, and the app would keep running in a half-done state.
process.on('unhandledRejection', (reason) => {
  console.error('CyberGo: a request that nobody waited for failed.', reason);
});

process.on('SIGINT', () => {
  db.flush();
  app.quit();
});

process.on('SIGTERM', () => {
  db.flush();
  app.quit();
});

// Win+Up / Win+Down are Windows gestures: the shell performs them and the key
// never reaches the app. A frameless window can be left out of them, so the
// same action runs here when the key does arrive, instead of doing nothing.
function applyWindowsSnapFallback(win: BrowserWindow, input: Electron.Input): boolean {
  if (input.type !== 'keyDown' || !input.meta) return false;
  if (input.alt || input.control || input.shift) return false;
  if (input.key !== 'Up' && input.key !== 'Down') return false;
  if (win.isDestroyed() || win.isFullScreen()) return false;
  if (!win.isMaximizable() && !win.isMinimizable()) return false;

  if (input.key === 'Up') {
    if (win.isMaximizable() && !win.isMaximized()) win.maximize();
  } else if (win.isMaximized()) {
    win.unmaximize();
  } else if (win.isMinimizable()) {
    win.minimize();
  }
  return true;
}

// Alt+F4 is the close shortcut even when the X leaves CyberGo in the tray.
app.on('browser-window-created', (_event, window) => {
  // Alt+Tab (or any other focus loss) swallows the Alt keyup, so a stale flag
  // would turn a later X click into an explicit quit.
  window.on('blur', () => {
    altHeld = false;
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Alt') altHeld = input.type !== 'keyUp';
    if (input.type === 'keyDown' && input.alt && input.key === 'F4') {
      event.preventDefault();
      // The quit is user-requested, so the close handler must not turn it into
      // a hide to the tray.
      quitting = true;
      db.flush();
      app.quit();
      return;
    }
    if (applyWindowsSnapFallback(window, input)) event.preventDefault();
  });
});
