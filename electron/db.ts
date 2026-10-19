import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import {
  afterDismiss,
  buildSchedule,
  fireKey,
  fireTimeFor,
  normalizeRecurrence,
  parseLocal,
  snoozeUntilFromNow,
} from '../shared/schedule';
import type {
  AccessLogEntry,
  AccessLogEvent,
  AccessLogMethod,
  AuthMethod,
  DisplayBounds,
  Freq,
  Group,
  Importance,
  Item,
  ItemDraft,
  Kind,
  PublicSettings,
  RecoveryNotice,
  Recurrence,
} from '../shared/types';

const require = createRequire(import.meta.url);

let SQL: any;
let db: any;
let dbPath = '';
let wasmPath = '';

/**
 * Schema version kept in `PRAGMA user_version`.
 *
 * 0: an installation created by an alpha build (no versioning at all).
 * 1: the base tables plus the access log.
 * 2: item indexes and the recurrence day anchor column.
 */
export const SCHEMA_VERSION = 2;

/** How long a burst of mutations may stay in memory before it reaches the disk. */
const FLUSH_DELAY_MS = 250;
/** Upper bound for the delay, so a continuous stream of mutations still reaches the disk. */
const FLUSH_MAX_DELAY_MS = 1_000;
/** Delay used to retry a write that Windows refused because the file was busy. */
const FLUSH_RETRY_DELAY_MS = 1_000;
/** Automatic retries are capped so a permanently full disk does not spin forever. */
const MAX_FLUSH_RETRIES = 5;

let dirty = false;
let dirtySince = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushRetries = 0;
let closed = false;
let recovery: RecoveryNotice | null = null;

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

/** One table per entry so a migration can report whether it really changed the file. */
const TABLE_DEFINITIONS: { name: string; sql: string }[] = [
  {
    name: 'settings',
    sql: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
  {
    name: 'groups',
    sql: `CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  },
  {
    name: 'items',
    sql: `CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      all_day INTEGER NOT NULL DEFAULT 0,
      start_at TEXT,
      end_at TEXT,
      importance TEXT NOT NULL DEFAULT 'normal',
      color TEXT NOT NULL DEFAULT '',
      group_id TEXT,
      recurrence TEXT,
      recurrence_day INTEGER,
      remind_minutes INTEGER NOT NULL DEFAULT 0,
      occurrence_at TEXT,
      next_fire_at TEXT,
      snooze_until TEXT,
      alert_key TEXT,
      completed_at TEXT,
      deleted_at TEXT,
      remote_id TEXT,
      sync_rev INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  },
  {
    name: 'access_log',
    sql: `CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL,
      event TEXT NOT NULL,
      method TEXT NOT NULL
    )`,
  },
];

const INDEX_DEFINITIONS: { name: string; sql: string }[] = [
  { name: 'idx_items_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at ASC)' },
  { name: 'idx_items_group_id', sql: 'CREATE INDEX IF NOT EXISTS idx_items_group_id ON items (group_id ASC)' },
  { name: 'idx_items_deleted_at', sql: 'CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items (deleted_at ASC)' },
  { name: 'idx_items_next_fire_at', sql: 'CREATE INDEX IF NOT EXISTS idx_items_next_fire_at ON items (next_fire_at ASC)' },
];

/**
 * Columns a repair migration can add to a table that already exists.
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, so the column list is checked first.
 * A primary key column cannot be added this way and only lives in the CREATE statements.
 */
const REPAIRABLE_COLUMNS: { table: string; name: string; definition: string }[] = [
  { table: 'settings', name: 'value', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'groups', name: 'color', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'groups', name: 'sort_order', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'items', name: 'notes', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'items', name: 'all_day', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'items', name: 'importance', definition: "TEXT NOT NULL DEFAULT 'normal'" },
  { table: 'items', name: 'color', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'items', name: 'remind_minutes', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'items', name: 'sync_rev', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'items', name: 'recurrence_day', definition: 'INTEGER' },
  { table: 'access_log', name: 'method', definition: "TEXT NOT NULL DEFAULT 'password'" },
];

type Migration = {
  version: number;
  description: string;
  /** Returns true when the migration actually changed the schema. */
  apply: () => boolean;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'base tables and the access log',
    apply: () => {
      let changed = false;
      for (const table of TABLE_DEFINITIONS) {
        if (tableExists(table.name)) continue;
        db.run(table.sql);
        changed = true;
      }
      return changed;
    },
  },
  {
    version: 2,
    description: 'item indexes and the recurrence day anchor column',
    apply: () => {
      let changed = false;
      for (const column of REPAIRABLE_COLUMNS) {
        if (addColumnIfMissing(column.table, column.name, column.definition)) changed = true;
      }
      for (const index of INDEX_DEFINITIONS) {
        if (indexExists(index.name)) continue;
        db.run(index.sql);
        changed = true;
      }
      return changed;
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Low level helpers                                                           */
/* -------------------------------------------------------------------------- */

function queryAll(sql: string, params: unknown[] = []): any[] {
  if (!db) throw new Error('database closed');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryGet(sql: string, params: unknown[] = []): any | null {
  return queryAll(sql, params)[0] ?? null;
}

function tableExists(name: string): boolean {
  return !!queryGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
}

function indexExists(name: string): boolean {
  return !!queryGet("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?", [name]);
}

/** Table and column names come from the constants above, never from user input. */
function columnExists(table: string, column: string): boolean {
  return queryAll(`PRAGMA table_info(${table})`).some((row) => String(row.name) === column);
}

/** SQL.js has no `ADD COLUMN IF NOT EXISTS`, so the column is checked first. */
function addColumnIfMissing(table: string, column: string, definition: string): boolean {
  if (!tableExists(table)) return false;
  if (columnExists(table, column)) return false;
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

function readUserVersion(): number {
  const row = queryGet('PRAGMA user_version');
  const value = row ? Number(row.user_version) : 0;
  return Number.isFinite(value) ? value : 0;
}

function setUserVersion(version: number) {
  db.run(`PRAGMA user_version = ${Math.max(0, Math.floor(version))}`);
}

/**
 * Brings the open database up to `SCHEMA_VERSION`.
 * Returns "changed" when the schema was changed and therefore has to be
 * written back, and "newer" when the file comes from a newer build and must
 * not be touched at all.
 */
function applySchema(): 'changed' | 'current' | 'newer' {
  const version = readUserVersion();
  // A database written by a newer build is left untouched.
  if (version > SCHEMA_VERSION) return 'newer';

  // Version 0 without any table means a brand new installation.
  if (version === 0 && !tableExists('items')) {
    for (const table of TABLE_DEFINITIONS) db.run(table.sql);
    for (const index of INDEX_DEFINITIONS) db.run(index.sql);
    setUserVersion(SCHEMA_VERSION);
    return 'changed';
  }

  let changed = false;
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    if (migration.apply()) changed = true;
  }
  if (readUserVersion() !== SCHEMA_VERSION) {
    setUserVersion(SCHEMA_VERSION);
    changed = true;
  }
  return changed ? 'changed' : 'current';
}

/* -------------------------------------------------------------------------- */
/* Deferred writes                                                             */
/* -------------------------------------------------------------------------- */

/** Marks the in-memory database as changed and schedules a flush. */
function markDirty() {
  if (!db) return;
  if (!dirty) dirtySince = Date.now();
  dirty = true;
  scheduleFlush();
}

/**
 * Schedules the write. Every new mutation postpones it, so a burst of
 * changes costs a single write, but the wait never grows past
 * FLUSH_MAX_DELAY_MS, so a continuous stream of changes still reaches the disk.
 */
function scheduleFlush(delay = FLUSH_DELAY_MS) {
  if (closed) return;
  if (flushTimer) clearTimeout(flushTimer);
  const waited = dirtySince ? Date.now() - dirtySince : 0;
  const wait = Math.max(0, Math.min(delay, FLUSH_MAX_DELAY_MS - waited));
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, wait);
  (flushTimer as unknown as { unref?: () => void }).unref?.();
}

/**
 * Writes the database to disk when there is something pending.
 * The write is atomic: a temporary file in the same directory is written and
 * fsynced, then renamed over the target. A failed rename (Windows refuses it
 * while another handle is open) keeps the dirty flag so the next flush retries.
 */
export function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!db || !dirty) return;

  let data: Uint8Array;
  try {
    data = db.export();
  } catch (error) {
    console.error('CyberGo: could not serialize the database.', error);
    // The change stays pending, so the write is tried again later. Without
    // this the change would wait for the next mutation, and it would be
    // lost for good when the app closed.
    flushRetries += 1;
    dirtySince = Date.now();
    if (flushRetries < MAX_FLUSH_RETRIES) scheduleFlush(FLUSH_RETRY_DELAY_MS);
    return;
  }

  const tmp = dbPath + '.tmp';
  try {
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, Buffer.from(data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, dbPath);
    dirty = false;
    dirtySince = 0;
    flushRetries = 0;
  } catch (error) {
    console.error('CyberGo: could not write the database file, the write will be retried.', error);
    flushRetries += 1;
    // The wait starts again from here, otherwise the retry would fire
    // immediately and give up after a few attempts in a row.
    dirtySince = Date.now();
    if (flushRetries < MAX_FLUSH_RETRIES) scheduleFlush(FLUSH_RETRY_DELAY_MS);
  }
}

/** Flushes the pending write and closes the handle. */
export function close() {
  closed = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flush();
  if (db) {
    try {
      db.close();
    } catch (error) {
      console.error('CyberGo: could not close the database cleanly.', error);
    }
    db = null;
  }
}

/* -------------------------------------------------------------------------- */
/* Recovery                                                                    */
/* -------------------------------------------------------------------------- */

function backupsDirectory(): string {
  return path.join(path.dirname(dbPath), 'backups');
}

function listBackupFiles(): string[] {
  try {
    return fs.readdirSync(backupsDirectory())
      .filter((name) => name.toLowerCase().endsWith('.db'))
      .map((name) => {
        const file = path.join(backupsDirectory(), name);
        return { file, mtime: fs.statSync(file).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .map((entry) => entry.file);
  } catch {
    return [];
  }
}

/** Opens a file and proves it really is a database, otherwise it throws. */
function openDatabaseFile(bytes: Uint8Array): any {
  const handle = new SQL.Database(bytes);
  try {
    handle.exec('SELECT count(*) FROM sqlite_master');
  } catch (error) {
    try {
      handle.close();
    } catch {
      // The handle is already unusable.
    }
    throw error;
  }
  return handle;
}

/** Restores the most recent backup that can still be opened. */
function restoreFromBackup(): { handle: any; file: string } | null {
  for (const file of listBackupFiles()) {
    try {
      return { handle: openDatabaseFile(fs.readFileSync(file)), file };
    } catch (error) {
      console.error(`CyberGo: the backup ${path.basename(file)} could not be opened.`, error);
    }
  }
  return null;
}

/**
 * A name no other file can take, so a second corruption never overwrites the
 * copy that was kept of the first one.
 */
function corruptFileName(): string {
  const now = new Date();
  const p = (value: number, size = 2) => String(value).padStart(size, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
    + `T${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}-${p(now.getMilliseconds(), 3)}`;
  const folder = path.dirname(dbPath);
  let name = `cybergo.corrupt-${stamp}.db`;
  let counter = 1;
  while (fs.existsSync(path.join(folder, name))) {
    name = `cybergo.corrupt-${stamp}-${counter}.db`;
    counter += 1;
  }
  return name;
}

/** Moves an unreadable database aside so the original bytes are never lost. */
function setAsideCorruptFile(): string | null {
  const target = path.join(path.dirname(dbPath), corruptFileName());
  try {
    fs.renameSync(dbPath, target);
    return target;
  } catch (error) {
    console.error('CyberGo: could not move the unreadable database aside.', error);
  }
  try {
    fs.copyFileSync(dbPath, target);
    fs.unlinkSync(dbPath);
    return target;
  } catch (error) {
    console.error('CyberGo: could not copy the unreadable database aside.', error);
    return null;
  }
}

/**
 * Keeps a copy of the damaged file next to it.
 *
 * The live file is left where it is, because the recovered copy replaces it
 * a moment later. A file that is only worth keeping must never be moved
 * away from the place the app expects to find it.
 */
function preserveCorruptFile(): string | null {
  const target = path.join(path.dirname(dbPath), corruptFileName());
  try {
    fs.copyFileSync(dbPath, target);
    return target;
  } catch (error) {
    console.error('CyberGo: could not keep a copy of the damaged database.', error);
    return null;
  }
}

/** Opens the live database, recovering from a corrupt or unreadable file. */
function openLiveDatabase(): any {
  if (!fs.existsSync(dbPath)) return new SQL.Database();

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(dbPath);
  } catch (error) {
    console.error('CyberGo: could not read the database file.', error);
    recovery = { kind: 'empty' };
    return new SQL.Database();
  }

  try {
    return openDatabaseFile(bytes);
  } catch (error) {
    console.error('CyberGo: the database file is damaged.', error);
    const restored = restoreFromBackup();
    if (restored) {
      // The recovered copy is about to replace the live file, so a copy of
      // the damaged one is kept first. Nothing it held is ever thrown away.
      const kept = preserveCorruptFile();
      recovery = kept
        ? { kind: 'backup', file: path.basename(restored.file), keptAs: path.basename(kept) }
        : { kind: 'backup', file: path.basename(restored.file) };
      return restored.handle;
    }
    const aside = setAsideCorruptFile();
    recovery = aside
      ? { kind: 'set-aside', file: path.basename(aside) }
      : { kind: 'unreadable' };
    return new SQL.Database();
  }
}

/** What the recovery did, or null when nothing went wrong. The text is built by the interface. */
export function recoveryNote(): RecoveryNotice | null {
  return recovery;
}

/* -------------------------------------------------------------------------- */
/* Recurrence and row mapping                                                  */
/* -------------------------------------------------------------------------- */

function validDay(value: unknown): number | null {
  const day = Number(value);
  if (!Number.isFinite(day)) return null;
  return day >= 1 && day <= 31 ? Math.floor(day) : null;
}

/** The local calendar day of an ISO timestamp, used to anchor a monthly series. */
function localDateString(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Reads a stored recurrence. Rows written by older builds carry no day anchor,
 * so the anchor is repaired in memory from the start date and the repair is
 * persisted the next time the row is written.
 */
function parseRecurrence(
  raw: string | null,
  startLocal: string | null,
  anchorColumn: number | null,
): Recurrence | null {
  if (!raw) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || !parsed.freq) return null;
  // A frequency that is not one of the four cannot be guessed. Reading it
  // as yearly used to turn a row into a series that never came back.
  if (parsed.freq !== 'daily' && parsed.freq !== 'weekly' && parsed.freq !== 'monthly' && parsed.freq !== 'yearly') {
    return null;
  }
  const base: Recurrence = {
    freq: parsed.freq as Freq,
    interval: Math.max(1, Number(parsed.interval) || 1),
    until: parsed.until || null,
    dayOfMonth: validDay(parsed.dayOfMonth) ?? validDay(anchorColumn),
  };
  return normalizeRecurrence(base, startLocal);
}

function mapItem(row: any): Item {
  if (!row) throw new Error('item');
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    notes: row.notes ?? '',
    allDay: !!row.all_day,
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    importance: row.importance,
    color: row.color ?? '',
    groupId: row.group_id ?? null,
    recurrence: parseRecurrence(
      row.recurrence ?? null,
      localDateString(row.start_at ?? null),
      row.recurrence_day == null ? null : Number(row.recurrence_day),
    ),
    remindMinutes: Number(row.remind_minutes) || 0,
    occurrenceAt: row.occurrence_at ?? null,
    nextFireAt: row.next_fire_at ?? null,
    snoozeUntil: row.snooze_until ?? null,
    alertKey: row.alert_key ?? null,
    completedAt: row.completed_at ?? null,
    deletedAt: row.deleted_at ?? null,
    remoteId: row.remote_id ?? null,
    syncRev: Number(row.sync_rev) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroup(row: any): Group {
  if (!row) throw new Error('group');
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function getSetting(key: string): string | null {
  const row = queryGet('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  markDirty();
}

function boolSetting(key: string, fallback: boolean): boolean {
  const v = getSetting(key);
  if (v == null) return fallback;
  return v === '1' || v === 'true';
}

function displayBoundsSetting(value: string | null): DisplayBounds | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DisplayBounds>;
    if (
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height) &&
      Number(parsed.width) > 0 &&
      Number(parsed.height) > 0
    ) {
      return {
        x: Number(parsed.x),
        y: Number(parsed.y),
        width: Number(parsed.width),
        height: Number(parsed.height),
      };
    }
  } catch {
    // Ignore malformed display data and fall back to the active monitor.
  }
  return null;
}

/** Reads the whole settings table in one query. */
function readSettingMap(): Map<string, string> {
  const values = new Map<string, string>();
  for (const row of queryAll('SELECT key, value FROM settings')) {
    values.set(String(row.key), String(row.value));
  }
  return values;
}

export function readSettings(locale: 'es' | 'en'): PublicSettings {
  const values = readSettingMap();
  const get = (key: string): string | null => (values.has(key) ? values.get(key)! : null);
  const bool = (key: string, fallback: boolean): boolean => {
    const v = get(key);
    if (v == null) return fallback;
    return v === '1' || v === 'true';
  };
  const theme = get('theme');
  const language = get('language');
  const lockLevel = get('lock_level');
  const reminderDisplayRaw = get('reminder_display_id');
  const reminderDisplayId = reminderDisplayRaw == null ? NaN : Number(reminderDisplayRaw);
  const reminderPosition = get('reminder_position');
  return {
    theme: theme === 'gray' || theme === 'light' || theme === 'cybergo' ? theme : 'cybergo',
    language: language === 'en' || language === 'es' ? language : locale,
    soundEnabled: bool('sound_enabled', true),
    soundPath: get('sound_path') ?? '',
    lockLevel: lockLevel === 'hard' ? 'hard' : 'soft',
    lockOnLaunch: bool('lock_on_launch', false),
    autobackup: bool('autobackup', true),
    autobackupKeep: Math.max(1, Number(get('autobackup_keep') || '7') || 7),
    openAtLogin: bool('open_at_login', false),
    reminderAlwaysOnTop: bool('reminder_always_on_top', true),
    reminderDisplayId: Number.isFinite(reminderDisplayId) ? Math.trunc(reminderDisplayId) : -1,
    reminderDisplayBounds: displayBoundsSetting(get('reminder_display_bounds')),
    reminderPosition: reminderPosition === 'top-left'
      || reminderPosition === 'top-center'
      || reminderPosition === 'top-right'
      || reminderPosition === 'bottom-left'
      || reminderPosition === 'bottom-center'
      || reminderPosition === 'bottom-right'
      ? reminderPosition
      : 'bottom-right',
    passwordHint: get('password_hint') ?? '',
    authMethod: get('auth_method') === 'pin' ? 'pin' : 'password',
    accessLogEnabled: bool('access_log_enabled', true),
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export function listItems(): Item[] {
  return queryAll('SELECT * FROM items ORDER BY created_at ASC').map(mapItem);
}

export function listGroups(): Group[] {
  return queryAll('SELECT * FROM groups ORDER BY sort_order ASC, name COLLATE NOCASE ASC').map(mapGroup);
}

export function hasPassword(): boolean {
  return !!getSetting('password_hash');
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

export async function initDatabase(file: string, wasm: string, locale: 'es' | 'en') {
  dbPath = file;
  wasmPath = wasm;
  closed = false;
  recovery = null;
  dirty = false;
  dirtySince = 0;

  const initSqlJs = require('sql.js');
  const init = initSqlJs.default ?? initSqlJs;
  SQL = await init({ locateFile: () => wasmPath });

  db = openLiveDatabase();
  const schema = applySchema();
  if (schema === 'newer') {
    // The file comes from a newer build. Writing to it would rewrite data
    // this build does not understand, so it is left exactly as it is.
    console.warn(`CyberGo: the database is from a newer build (version ${readUserVersion()}). It was left untouched.`);
    return;
  }
  // A recovery means the file on disk is not what the app is holding, so the
  // live database has to be written back even when the schema did not change.
  if (recovery) markDirty();
  if (schema === 'changed') markDirty();

  if (!getSetting('theme')) setSetting('theme', 'cybergo');
  if (!getSetting('language')) setSetting('language', locale);
  if (!getSetting('autobackup')) setSetting('autobackup', '1');
  if (!getSetting('autobackup_keep')) setSetting('autobackup_keep', '7');
  if (!getSetting('lock_level')) setSetting('lock_level', 'soft');
  if (!getSetting('sound_enabled')) setSetting('sound_enabled', '1');
  if (getSetting('access_log_enabled') == null) setSetting('access_log_enabled', '1');

  // The schema and the defaults have to reach the disk right away, a fresh
  // installation would otherwise have no database file at all.
  flush();
}

/**
 * Replaces the live database with the file on disk.
 * The new handle is opened first so a broken file never leaves the app without
 * a database. Returns false when the file could not be opened.
 */
export function reloadFromDisk(): boolean {
  if (!SQL) return false;

  let next: any;
  try {
    next = openDatabaseFile(fs.readFileSync(dbPath));
  } catch (error) {
    console.error('CyberGo: could not reload the database from disk.', error);
    return false;
  }

  const previous = db;
  db = next;
  let schemaChanged = false;
  try {
    schemaChanged = applySchema() === 'changed';
  } catch (error) {
    console.error('CyberGo: could not prepare the reloaded database.', error);
    db = previous;
    try {
      next.close();
    } catch {
      // The handle is already unusable.
    }
    return false;
  }
  if (previous) {
    try {
      previous.close();
    } catch (error) {
      console.error('CyberGo: could not close the previous database handle.', error);
    }
  }
  if (schemaChanged) {
    // The migration has to be written back to the file that was just loaded.
    markDirty();
  } else {
    // The file on disk is now the source of truth, any pending write is dropped.
    dirty = false;
    dirtySince = 0;
  }
  return true;
}

export function databasePath() {
  return dbPath;
}

/**
 * Whether a database file can be opened.
 *
 * A backup is checked with this before it replaces the live file, so a
 * damaged copy never leaves the app without a usable database.
 */
export function canOpenFile(file: string): boolean {
  if (!SQL) return false;
  let handle: any;
  try {
    handle = openDatabaseFile(fs.readFileSync(file));
  } catch (error) {
    console.error('CyberGo: the database file could not be opened.', error);
    return false;
  }
  try {
    handle.close();
  } catch {
    // The handle is already unusable.
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export function saveGroup(input: { id?: string; name: string; color: string }): Group {
  const name = input.name.trim();
  if (!name) throw new Error('name');
  // The color is drawn as a background, so only a plain color is accepted.
  // Anything else would be able to reach out to the network.
  const color = /^#[0-9a-fA-F]{6}$/.test((input.color || '').trim())
    ? input.color.trim()
    : '#6c63e6';
  const now = new Date().toISOString();
  if (input.id) {
    db.run('UPDATE groups SET name = ?, color = ? WHERE id = ?', [name, color, input.id]);
    const row = queryGet('SELECT * FROM groups WHERE id = ?', [input.id]);
    if (!row) throw new Error('group');
    markDirty();
    return mapGroup(row);
  }
  const id = crypto.randomUUID();
  const sort = queryAll('SELECT COUNT(*) AS n FROM groups')[0]?.n ?? 0;
  db.run(
    'INSERT INTO groups (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, color, Number(sort), now],
  );
  const row = queryGet('SELECT * FROM groups WHERE id = ?', [id]);
  if (!row) throw new Error('group');
  markDirty();
  return mapGroup(row);
}

export function deleteGroup(id: string) {
  db.run('UPDATE items SET group_id = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE group_id = ?', [new Date().toISOString(), id]);
  db.run('DELETE FROM groups WHERE id = ?', [id]);
  markDirty();
}

function writeSchedule(id: string, draft: ItemDraft, keepAlert: boolean) {
  const schedule = buildSchedule(draft);
  const now = new Date().toISOString();
  // The anchor is filled in before the recurrence is stored, so a monthly
  // series never slides to the 28th of February and stays there.
  const recurrence = normalizeRecurrence(draft.recurrence, draft.startLocal);
  const recurrenceJson = recurrence ? JSON.stringify(recurrence) : null;
  const recurrenceDay = recurrence && (recurrence.freq === 'monthly' || recurrence.freq === 'yearly')
    ? validDay(recurrence.dayOfMonth)
    : null;
  const existing = queryGet('SELECT * FROM items WHERE id = ?', [id]);
  if (!existing) {
    db.run(
      `INSERT INTO items (
        id, kind, title, notes, all_day, start_at, end_at, importance, color, group_id,
        recurrence, recurrence_day, remind_minutes, occurrence_at, next_fire_at, snooze_until, alert_key,
        completed_at, deleted_at, remote_id, sync_rev, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, ?, ?)`,
      [
        id, draft.kind, draft.title.trim(), draft.notes ?? '', draft.allDay ? 1 : 0,
        schedule.startAt, schedule.endAt, draft.importance, draft.color || '', draft.groupId,
        recurrenceJson, recurrenceDay, Math.max(0, draft.remindMinutes || 0), schedule.occurrenceAt, schedule.nextFireAt,
        now, now,
      ],
    );
    return;
  }
  const prev = mapItem(existing);
  const remind = Math.max(0, draft.remindMinutes || 0);
  // Changing the reminder offset only moves the alert. The series keeps the
  // occurrence it had reached, otherwise a series that had already advanced
  // would jump back to its first date and fire for a moment that has passed.
  const scheduleChanged = prev.startAt !== schedule.startAt
    || JSON.stringify(prev.recurrence) !== recurrenceJson
    || prev.allDay !== draft.allDay;
  const occurrenceAt = scheduleChanged ? schedule.occurrenceAt : prev.occurrenceAt;
  // A dismissed occurrence stays dismissed, it only waits for the next one.
  const dismissed = prev.alertKey === 'dismissed' && !prev.snoozeUntil;
  const nextFireAt = scheduleChanged
    ? schedule.nextFireAt
    : dismissed
      ? prev.nextFireAt
      : fireTimeFor(occurrenceAt, remind);
  db.run(
    `UPDATE items SET
      kind = ?, title = ?, notes = ?, all_day = ?, start_at = ?, end_at = ?, importance = ?,
      color = ?, group_id = ?, recurrence = ?, recurrence_day = ?, remind_minutes = ?, occurrence_at = ?,
      next_fire_at = ?, snooze_until = ?, alert_key = ?, updated_at = ?, sync_rev = sync_rev + 1
     WHERE id = ?`,
    [
      draft.kind, draft.title.trim(), draft.notes ?? '', draft.allDay ? 1 : 0,
      schedule.startAt, schedule.endAt, draft.importance, draft.color || '', draft.groupId,
      recurrenceJson, recurrenceDay, remind,
      occurrenceAt,
      nextFireAt,
      scheduleChanged ? null : prev.snoozeUntil,
      scheduleChanged || !keepAlert ? null : prev.alertKey,
      now, id,
    ],
  );
}

export function saveItem(draft: ItemDraft): Item {
  const title = draft.title.trim();
  if (!title) throw new Error('title');
  const color = /^#[0-9a-fA-F]{6}$/.test((draft.color || '').trim()) ? draft.color.trim() : '';
  if (draft.kind === 'event' && !draft.startLocal) throw new Error('date');
  if (draft.startLocal && draft.endLocal) {
    const start = parseLocal(draft.startLocal, draft.allDay);
    const end = parseLocal(draft.endLocal, draft.allDay);
    if (end.getTime() < start.getTime()) throw new Error('end');
  }
  const id = draft.id || crypto.randomUUID();
  writeSchedule(id, { ...draft, title, color }, true);
  markDirty();
  return mapItem(queryGet('SELECT * FROM items WHERE id = ?', [id]));
}

export function softDelete(id: string) {
  const now = new Date().toISOString();
  db.run('UPDATE items SET deleted_at = ?, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [now, now, id]);
  markDirty();
}

export function restoreItem(id: string) {
  const now = new Date().toISOString();
  db.run('UPDATE items SET deleted_at = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [now, id]);
  markDirty();
}

export function purgeItem(id: string) {
  db.run('DELETE FROM items WHERE id = ?', [id]);
  markDirty();
}

export function emptyTrash() {
  db.run('DELETE FROM items WHERE deleted_at IS NOT NULL');
  markDirty();
}

export function completeItem(id: string) {
  const now = new Date().toISOString();
  db.run(
    `UPDATE items SET completed_at = ?, next_fire_at = NULL, snooze_until = NULL, alert_key = 'dismissed',
     updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?`,
    [now, now, id],
  );
  markDirty();
}

export function dismissItem(id: string) {
  const row = queryGet('SELECT * FROM items WHERE id = ?', [id]);
  if (!row) return;
  const item = mapItem(row);
  const next = afterDismiss(item);
  const now = new Date().toISOString();
  db.run(
    `UPDATE items SET occurrence_at = ?, next_fire_at = ?, snooze_until = ?, alert_key = ?, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?`,
    [next.occurrenceAt, next.nextFireAt, next.snoozeUntil, next.alertKey, now, id],
  );
  markDirty();
}

export function snoozeItem(id: string, untilIso: string) {
  const now = new Date().toISOString();
  db.run(
    `UPDATE items SET snooze_until = ?, alert_key = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?`,
    [untilIso, now, id],
  );
  markDirty();
}

export function snoozeMinutes(id: string, minutes: number) {
  snoozeItem(id, snoozeUntilFromNow(minutes));
}

export function markAlerted(ids: string[]) {
  const now = new Date().toISOString();
  for (const id of ids) {
    const row = queryGet('SELECT * FROM items WHERE id = ?', [id]);
    if (!row) continue;
    const item = mapItem(row);
    const key = fireKey(item);
    if (!key) continue;
    db.run('UPDATE items SET alert_key = ?, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [key, now, id]);
  }
  markDirty();
}

/**
 * Puts the alert key back. A reminder that was announced but could not be
 * shown has to be able to fire again instead of staying silent forever.
 */
export function restoreAlertKeys(entries: { id: string; alertKey: string | null }[]) {
  if (!entries.length) return;
  const now = new Date().toISOString();
  for (const entry of entries) {
    db.run('UPDATE items SET alert_key = ?, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [entry.alertKey, now, entry.id]);
  }
  markDirty();
}

export function applySettingsPatch(patch: Partial<PublicSettings>) {
  const map: Record<string, string | undefined> = {
    theme: patch.theme,
    language: patch.language,
    sound_enabled: patch.soundEnabled == null ? undefined : patch.soundEnabled ? '1' : '0',
    sound_path: patch.soundPath,
    lock_level: patch.lockLevel,
    lock_on_launch: patch.lockOnLaunch == null ? undefined : patch.lockOnLaunch ? '1' : '0',
    autobackup: patch.autobackup == null ? undefined : patch.autobackup ? '1' : '0',
    autobackup_keep: patch.autobackupKeep == null ? undefined : String(Math.max(1, Math.floor(patch.autobackupKeep))),
    open_at_login: patch.openAtLogin == null ? undefined : patch.openAtLogin ? '1' : '0',
    reminder_always_on_top: patch.reminderAlwaysOnTop == null ? undefined : patch.reminderAlwaysOnTop ? '1' : '0',
    reminder_display_id: patch.reminderDisplayId == null ? undefined : String(Math.trunc(patch.reminderDisplayId)),
    reminder_display_bounds: patch.reminderDisplayBounds === undefined
      ? undefined
      : patch.reminderDisplayBounds
        ? JSON.stringify(patch.reminderDisplayBounds)
        : '',
    reminder_position: patch.reminderPosition,
    password_hint: patch.passwordHint,
    access_log_enabled: patch.accessLogEnabled == null ? undefined : patch.accessLogEnabled ? '1' : '0',
  };
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  markDirty();
}

const ACCESS_LOG_RETENTION = 100;

export function listAccessLog(limit = 50): AccessLogEntry[] {
  const safeLimit = Math.min(ACCESS_LOG_RETENTION, Math.max(1, Math.floor(limit)));
  return queryAll(
    `SELECT id, occurred_at, event, method FROM access_log ORDER BY id DESC LIMIT ${safeLimit}`,
  ).map((row) => ({
    id: Number(row.id),
    occurredAt: String(row.occurred_at),
    event: row.event as AccessLogEvent,
    method: row.method as AccessLogMethod,
  }));
}

export function recordAccessEvent(event: AccessLogEvent, method: AccessLogMethod) {
  if (!boolSetting('access_log_enabled', true)) return;
  db.run(
    `INSERT INTO access_log (occurred_at, event, method) VALUES (?, ?, ?)`,
    [new Date().toISOString(), event, method],
  );
  db.run(
    `DELETE FROM access_log WHERE id NOT IN (
      SELECT id FROM access_log ORDER BY id DESC LIMIT ${ACCESS_LOG_RETENTION}
    )`,
  );
  markDirty();
}

export function clearAccessLog() {
  db.run('DELETE FROM access_log');
  markDirty();
}

export function setPasswordHash(hash: string) {
  setSetting('password_hash', hash);
}

export function passwordHash(): string | null {
  return getSetting('password_hash');
}

export function setRecoveryHash(hash: string | null) {
  if (!hash) {
    db.run('DELETE FROM settings WHERE key = ?', ['recovery_code_hash']);
    markDirty();
    return;
  }
  setSetting('recovery_code_hash', hash);
}

export function recoveryHash(): string | null {
  return getSetting('recovery_code_hash');
}

export function setAuthMethod(method: AuthMethod) {
  setSetting('auth_method', method);
}

export function authMethod(): AuthMethod {
  return getSetting('auth_method') === 'pin' ? 'pin' : 'password';
}

export function clearAuth() {
  db.run(`DELETE FROM settings WHERE key IN ('password_hash', 'recovery_code_hash', 'password_hint', 'auth_method')`);
  markDirty();
}

export function touchAutobackup(iso: string) {
  setSetting('autobackup_last', iso);
}

export function autobackupLast(): string | null {
  return getSetting('autobackup_last');
}

export function seedDemoIfEmpty() {
  if (listItems().length) return;
  const g = saveGroup({ name: 'Personal', color: '#6c63e6' });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(9, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  const yLocal = `${yesterday.getFullYear()}-${p(yesterday.getMonth() + 1)}-${p(yesterday.getDate())}T09:00`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tLocal = `${tomorrow.getFullYear()}-${p(tomorrow.getMonth() + 1)}-${p(tomorrow.getDate())}T11:00`;
  saveItem({
    kind: 'event',
    title: 'RESPALDOS',
    notes: '',
    allDay: true,
    startLocal: yLocal.slice(0, 10),
    endLocal: null,
    importance: 'high',
    color: '#f59e0b',
    groupId: g.id,
    recurrence: { freq: 'monthly', interval: 1, until: null },
    remindMinutes: 0,
  });
  saveItem({
    kind: 'event',
    title: 'CITA',
    notes: '',
    allDay: false,
    startLocal: tLocal,
    endLocal: null,
    importance: 'normal',
    color: '#06b6d4',
    groupId: g.id,
    recurrence: null,
    remindMinutes: 30,
  });
  saveItem({
    kind: 'task',
    title: 'Revisar hosting',
    notes: '',
    allDay: false,
    startLocal: null,
    endLocal: null,
    importance: 'normal',
    color: '',
    groupId: null,
    recurrence: null,
    remindMinutes: 0,
  });
}

export function exportRows(): { items: Item[]; groups: Group[] } {
  return {
    items: listItems().filter((i) => !i.deletedAt),
    groups: listGroups(),
  };
}

export function insertImported(draft: ItemDraft) {
  saveItem(draft);
}

export type { Kind, Importance };
