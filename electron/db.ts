import crypto from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
import { afterDismiss, buildSchedule, fireKey, parseLocal, snoozeUntilFromNow } from '../shared/schedule';
import type { AuthMethod, Group, Importance, Item, ItemDraft, Kind, PublicSettings, Recurrence } from '../shared/types';

const require = createRequire(import.meta.url);

let SQL: any;
let db: any;
let dbPath = '';
let wasmPath = '';

function saveSoon() {
  if (!db) return;
  const data = db.export();
  const tmp = dbPath + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, dbPath);
}

function queryAll(sql: string, params: unknown[] = []): any[] {
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

function parseRecurrence(raw: string | null): Recurrence | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || !v.freq) return null;
    return { freq: v.freq, interval: Math.max(1, Number(v.interval) || 1), until: v.until || null };
  } catch {
    return null;
  }
}

function mapItem(row: any): Item {
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
    recurrence: parseRecurrence(row.recurrence),
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
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}

export function getSetting(key: string): string | null {
  const row = queryGet('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  saveSoon();
}

function boolSetting(key: string, fallback: boolean): boolean {
  const v = getSetting(key);
  if (v == null) return fallback;
  return v === '1' || v === 'true';
}

export function readSettings(locale: 'es' | 'en'): PublicSettings {
  const theme = getSetting('theme');
  const language = getSetting('language');
  const lockLevel = getSetting('lock_level');
  return {
    theme: theme === 'gray' || theme === 'light' || theme === 'cybergo' ? theme : 'cybergo',
    language: language === 'en' || language === 'es' ? language : locale,
    soundEnabled: boolSetting('sound_enabled', true),
    soundPath: getSetting('sound_path') ?? '',
    lockLevel: lockLevel === 'hard' ? 'hard' : 'soft',
    lockOnLaunch: boolSetting('lock_on_launch', false),
    autobackup: boolSetting('autobackup', true),
    autobackupKeep: Math.max(1, Number(getSetting('autobackup_keep') || '7') || 7),
    openAtLogin: boolSetting('open_at_login', false),
    reminderAlwaysOnTop: boolSetting('reminder_always_on_top', true),
    passwordHint: getSetting('password_hint') ?? '',
    authMethod: getSetting('auth_method') === 'pin' ? 'pin' : 'password',
  };
}

export function listItems(): Item[] {
  return queryAll('SELECT * FROM items ORDER BY created_at ASC').map(mapItem);
}

export function listGroups(): Group[] {
  return queryAll('SELECT * FROM groups ORDER BY sort_order ASC, name COLLATE NOCASE ASC').map(mapGroup);
}

export function hasPassword(): boolean {
  return !!getSetting('password_hash');
}

export async function initDatabase(file: string, wasm: string, locale: 'es' | 'en') {
  dbPath = file;
  wasmPath = wasm;
  const initSqlJs = require('sql.js');
  const init = initSqlJs.default ?? initSqlJs;
  SQL = await init({ locateFile: () => wasmPath });
  if (fs.existsSync(dbPath)) db = new SQL.Database(fs.readFileSync(dbPath));
  else db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
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
    );
  `);
  if (!getSetting('theme')) setSetting('theme', 'cybergo');
  if (!getSetting('language')) setSetting('language', locale);
  if (!getSetting('autobackup')) setSetting('autobackup', '1');
  if (!getSetting('autobackup_keep')) setSetting('autobackup_keep', '7');
  if (!getSetting('lock_level')) setSetting('lock_level', 'soft');
  if (!getSetting('sound_enabled')) setSetting('sound_enabled', '1');
  saveSoon();
}

export function reloadFromDisk() {
  if (db) db.close();
  db = new SQL.Database(fs.readFileSync(dbPath));
}

export function databasePath() {
  return dbPath;
}

export function saveGroup(input: { id?: string; name: string; color: string }): Group {
  const name = input.name.trim();
  if (!name) throw new Error('name');
  const now = new Date().toISOString();
  if (input.id) {
    db.run('UPDATE groups SET name = ?, color = ? WHERE id = ?', [name, input.color || '#6c63e6', input.id]);
    saveSoon();
    return mapGroup(queryGet('SELECT * FROM groups WHERE id = ?', [input.id]));
  }
  const id = crypto.randomUUID();
  const sort = queryAll('SELECT COUNT(*) AS n FROM groups')[0]?.n ?? 0;
  db.run(
    'INSERT INTO groups (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, input.color || '#6c63e6', Number(sort), now],
  );
  saveSoon();
  return mapGroup(queryGet('SELECT * FROM groups WHERE id = ?', [id]));
}

export function deleteGroup(id: string) {
  db.run('UPDATE items SET group_id = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE group_id = ?', [new Date().toISOString(), id]);
  db.run('DELETE FROM groups WHERE id = ?', [id]);
  saveSoon();
}

function writeSchedule(id: string, draft: ItemDraft, keepAlert: boolean) {
  const schedule = buildSchedule(draft);
  const now = new Date().toISOString();
  const recurrence = draft.recurrence ? JSON.stringify(draft.recurrence) : null;
  const existing = queryGet('SELECT * FROM items WHERE id = ?', [id]);
  if (!existing) {
    db.run(
      `INSERT INTO items (
        id, kind, title, notes, all_day, start_at, end_at, importance, color, group_id,
        recurrence, remind_minutes, occurrence_at, next_fire_at, snooze_until, alert_key,
        completed_at, deleted_at, remote_id, sync_rev, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, ?, ?)`,
      [
        id, draft.kind, draft.title.trim(), draft.notes ?? '', draft.allDay ? 1 : 0,
        schedule.startAt, schedule.endAt, draft.importance, draft.color || '', draft.groupId,
        recurrence, Math.max(0, draft.remindMinutes || 0), schedule.occurrenceAt, schedule.nextFireAt,
        now, now,
      ],
    );
    return;
  }
  const prev = mapItem(existing);
  const scheduleChanged = prev.startAt !== schedule.startAt
    || prev.remindMinutes !== Math.max(0, draft.remindMinutes || 0)
    || JSON.stringify(prev.recurrence) !== JSON.stringify(draft.recurrence)
    || prev.allDay !== draft.allDay;
  db.run(
    `UPDATE items SET
      kind = ?, title = ?, notes = ?, all_day = ?, start_at = ?, end_at = ?, importance = ?,
      color = ?, group_id = ?, recurrence = ?, remind_minutes = ?, occurrence_at = ?,
      next_fire_at = ?, snooze_until = ?, alert_key = ?, updated_at = ?, sync_rev = sync_rev + 1
     WHERE id = ?`,
    [
      draft.kind, draft.title.trim(), draft.notes ?? '', draft.allDay ? 1 : 0,
      schedule.startAt, schedule.endAt, draft.importance, draft.color || '', draft.groupId,
      recurrence, Math.max(0, draft.remindMinutes || 0),
      scheduleChanged ? schedule.occurrenceAt : prev.occurrenceAt,
      scheduleChanged ? schedule.nextFireAt : prev.nextFireAt,
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
  saveSoon();
  return mapItem(queryGet('SELECT * FROM items WHERE id = ?', [id]));
}

export function softDelete(id: string) {
  const now = new Date().toISOString();
  db.run('UPDATE items SET deleted_at = ?, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [now, now, id]);
  saveSoon();
}

export function restoreItem(id: string) {
  const now = new Date().toISOString();
  db.run('UPDATE items SET deleted_at = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?', [now, id]);
  saveSoon();
}

export function purgeItem(id: string) {
  db.run('DELETE FROM items WHERE id = ?', [id]);
  saveSoon();
}

export function emptyTrash() {
  db.run('DELETE FROM items WHERE deleted_at IS NOT NULL');
  saveSoon();
}

export function completeItem(id: string) {
  const now = new Date().toISOString();
  db.run(
    `UPDATE items SET completed_at = ?, next_fire_at = NULL, snooze_until = NULL, alert_key = 'dismissed',
     updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?`,
    [now, now, id],
  );
  saveSoon();
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
  saveSoon();
}

export function snoozeItem(id: string, untilIso: string) {
  const now = new Date().toISOString();
  db.run(
    `UPDATE items SET snooze_until = ?, alert_key = NULL, updated_at = ?, sync_rev = sync_rev + 1 WHERE id = ?`,
    [untilIso, now, id],
  );
  saveSoon();
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
    db.run('UPDATE items SET alert_key = ?, updated_at = ? WHERE id = ?', [key, now, id]);
  }
  saveSoon();
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
    password_hint: patch.passwordHint,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  saveSoon();
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
    saveSoon();
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
  saveSoon();
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
