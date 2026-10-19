import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as db from './db';

const require = createRequire(import.meta.url);
const wasm = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));

async function loadSql() {
  const initSqlJs = require('sql.js');
  const init = initSqlJs.default ?? initSqlJs;
  return init({ locateFile: () => wasm });
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cybergo-db-test-'));
}

/** Opens a database file read only so the tests can inspect what reached the disk. */
async function openFile(file: string) {
  const SQL = await loadSql();
  return new SQL.Database(fs.readFileSync(file));
}

function valuesOf(result: { columns: string[]; values: unknown[][] }[]): unknown[][] {
  return result[0]?.values ?? [];
}

/** The schema an alpha build created: no access log, no anchor column, no indexes. */
const ALPHA_SCHEMA = `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE items (
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
`;

const ALPHA_ACCESS_LOG = `
  CREATE TABLE access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    event TEXT NOT NULL,
    method TEXT NOT NULL
  );
`;

/** Writes a database that looks like an existing alpha installation. */
async function writeAlphaDatabase(file: string, options: { withAccessLog: boolean }) {
  const SQL = await loadSql();
  const handle = new SQL.Database();
  handle.run(ALPHA_SCHEMA);
  if (options.withAccessLog) handle.run(ALPHA_ACCESS_LOG);
  handle.run("INSERT INTO settings (key, value) VALUES ('theme', 'gray')");
  handle.run(
    "INSERT INTO groups (id, name, color, sort_order, created_at) VALUES ('g1', 'Trabajo', '#ff0000', 3, '2026-01-01T00:00:00.000Z')",
  );
  handle.run(
    `INSERT INTO items (
       id, kind, title, notes, all_day, start_at, end_at, importance, color, group_id,
       recurrence, remind_minutes, occurrence_at, next_fire_at, snooze_until, alert_key,
       completed_at, deleted_at, remote_id, sync_rev, created_at, updated_at
     ) VALUES (
       'i1', 'event', 'Reunión antigua', 'nota', 0, '2026-01-05T10:00:00.000Z', NULL, 'high', '#00ff00', 'g1',
       '{"freq":"monthly","interval":1,"until":null}', 15, '2026-01-05T10:00:00.000Z', '2026-01-05T09:45:00.000Z',
       NULL, NULL, NULL, NULL, NULL, 7, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
     )`,
  );
  if (options.withAccessLog) {
    handle.run(
      "INSERT INTO access_log (occurred_at, event, method) VALUES ('2026-01-02T00:00:00.000Z', 'success', 'password')",
    );
  }
  handle.run('PRAGMA user_version = 0');
  fs.writeFileSync(file, Buffer.from(handle.export()));
  handle.close();
}

test('access log can be disabled, cleared, and is retained to 100 entries', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    assert.equal(db.readSettings('en').accessLogEnabled, true);
    assert.equal(db.readSettings('en').reminderDisplayId, -1);
    assert.equal(db.readSettings('en').reminderPosition, 'bottom-right');
    db.applySettingsPatch({
      reminderDisplayId: 2,
      reminderDisplayBounds: { x: 1536, y: 0, width: 1280, height: 720 },
      reminderPosition: 'top-left',
    });
    assert.equal(db.readSettings('en').reminderDisplayId, 2);
    assert.deepEqual(db.readSettings('en').reminderDisplayBounds, { x: 1536, y: 0, width: 1280, height: 720 });
    assert.equal(db.readSettings('en').reminderPosition, 'top-left');

    db.recordAccessEvent('failure', 'password');
    db.recordAccessEvent('success', 'password');
    assert.deepEqual(db.listAccessLog().map((entry) => entry.event), ['success', 'failure']);

    db.applySettingsPatch({ accessLogEnabled: false });
    // The write is deferred, so it has to reach the disk before it is reloaded.
    db.flush();
    assert.equal(db.reloadFromDisk(), true);
    assert.equal(db.readSettings('en').accessLogEnabled, false);
    db.recordAccessEvent('blocked', 'password');
    assert.equal(db.listAccessLog().length, 2);

    db.applySettingsPatch({ accessLogEnabled: true });
    for (let index = 0; index < 105; index += 1) {
      db.recordAccessEvent('failure', 'pin');
    }
    assert.equal(db.listAccessLog(200).length, 100);

    db.clearAccessLog();
    assert.equal(db.listAccessLog().length, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an alpha database without an access log is migrated without data loss', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await writeAlphaDatabase(database, { withAccessLog: false });
    await db.initDatabase(database, wasm, 'en');

    assert.equal(db.recoveryNote(), null);
    // The old rows are still there.
    assert.equal(db.listGroups().length, 1);
    assert.equal(db.listGroups()[0].name, 'Trabajo');
    assert.equal(db.listItems().length, 1);
    assert.equal(db.listItems()[0].title, 'Reunión antigua');
    assert.equal(db.listItems()[0].syncRev, 7);
    // The existing setting survived and the defaults were added around it.
    assert.equal(db.readSettings('en').theme, 'gray');
    assert.equal(db.readSettings('en').lockLevel, 'soft');
    // The access log table was created by the migration.
    assert.deepEqual(db.listAccessLog(), []);
    db.recordAccessEvent('success', 'password');
    assert.equal(db.listAccessLog().length, 1);

    const handle = await openFile(database);
    const version = valuesOf(handle.exec('PRAGMA user_version'))[0]?.[0];
    assert.equal(Number(version), db.SCHEMA_VERSION);
    const columns = valuesOf(handle.exec('PRAGMA table_info(items)')).map((row) => String(row[1]));
    assert.ok(columns.includes('recurrence_day'), 'the anchor column is missing');
    const indexes = valuesOf(handle.exec("SELECT name FROM sqlite_master WHERE type = 'index'"))
      .map((row) => String(row[0]));
    for (const index of [
      'idx_items_created_at',
      'idx_items_group_id',
      'idx_items_deleted_at',
      'idx_items_next_fire_at',
    ]) {
      assert.ok(indexes.includes(index), `${index} is missing`);
    }
    handle.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an alpha database that already has an access log keeps its rows', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await writeAlphaDatabase(database, { withAccessLog: true });
    await db.initDatabase(database, wasm, 'en');

    assert.equal(db.recoveryNote(), null);
    assert.equal(db.listAccessLog().length, 1);
    assert.equal(db.listAccessLog()[0].event, 'success');
    assert.equal(db.listItems().length, 1);

    const handle = await openFile(database);
    const version = valuesOf(handle.exec('PRAGMA user_version'))[0]?.[0];
    assert.equal(Number(version), db.SCHEMA_VERSION);
    handle.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a monthly recurrence written by an old build is repaired with a day anchor', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await writeAlphaDatabase(database, { withAccessLog: false });
    await db.initDatabase(database, wasm, 'en');

    const item = db.listItems()[0];
    assert.ok(item.recurrence);
    assert.equal(item.recurrence.freq, 'monthly');
    assert.equal(item.recurrence.dayOfMonth, 5);

    // Writing the row back stores the anchor, so the series keeps its day.
    db.saveItem({
      id: item.id,
      kind: item.kind,
      title: item.title,
      notes: item.notes,
      allDay: item.allDay,
      startLocal: '2026-01-05T10:00',
      endLocal: null,
      importance: item.importance,
      color: item.color,
      groupId: item.groupId,
      recurrence: item.recurrence,
      remindMinutes: item.remindMinutes,
    });
    db.flush();

    const handle = await openFile(database);
    const stored = valuesOf(handle.exec('SELECT recurrence, recurrence_day FROM items WHERE id = ?', ['i1']));
    assert.equal(Number(stored[0]?.[1]), 5);
    assert.ok(String(stored[0]?.[0]).includes('"dayOfMonth":5'));
    handle.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a write is deferred and reaches the disk on its own', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea diferida',
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

    // The mutation is still in memory, the file on disk does not have it yet.
    const pending = await openFile(database);
    assert.equal(Number(valuesOf(pending.exec('SELECT COUNT(*) FROM items'))[0]?.[0]), 0);
    pending.close();

    // The scheduled flush writes it without anyone asking for it.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const written = await openFile(database);
    assert.equal(Number(valuesOf(written.exec('SELECT COUNT(*) FROM items'))[0]?.[0]), 1);
    written.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('many mutations reach the disk with a single flush', async () => {  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    const total = 40;
    for (let index = 0; index < total; index += 1) {
      db.saveItem({
        kind: 'task',
        title: `Tarea ${index}`,
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
    db.flush();

    const handle = await openFile(database);
    const rows = valuesOf(handle.exec('SELECT COUNT(*) FROM items'));
    assert.equal(Number(rows[0]?.[0]), total);
    handle.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt database file is set aside and the app still starts', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');
  const garbage = Buffer.from('this is not a sqlite database, it is damaged data');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea antes del daño',
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
    db.flush();
    db.close();

    fs.writeFileSync(database, garbage);
    await db.initDatabase(database, wasm, 'en');

    assert.notEqual(db.recoveryNote(), null);
    assert.equal(db.recoveryNote()!.kind, 'set-aside');
    assert.ok(db.recoveryNote()!.file!.includes('cybergo.corrupt-'));
    // The app keeps working on an empty database.
    assert.deepEqual(db.listItems(), []);
    assert.equal(db.readSettings('en').theme, 'cybergo');

    // The original bytes were not destroyed.
    const aside = fs.readdirSync(dir).filter((name) => name.startsWith('cybergo.corrupt-'));
    assert.equal(aside.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(dir, aside[0])), garbage);

    // The live file is a working database again.
    const handle = await openFile(database);
    const version = valuesOf(handle.exec('PRAGMA user_version'))[0]?.[0];
    assert.equal(Number(version), db.SCHEMA_VERSION);
    handle.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt database file is recovered from the most recent backup', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');
  const backups = path.join(dir, 'backups');
  const garbage = Buffer.from('broken bytes');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea respaldada',
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
    db.flush();
    db.close();

    fs.mkdirSync(backups, { recursive: true });
    fs.copyFileSync(database, path.join(backups, 'cybergo-auto-2026-01-01T00-00-00.db'));
    fs.writeFileSync(database, garbage);

    await db.initDatabase(database, wasm, 'en');

    assert.notEqual(db.recoveryNote(), null);
    assert.equal(db.recoveryNote()!.kind, 'backup');
    assert.ok(db.recoveryNote()!.file!.includes('cybergo-auto-2026-01-01T00-00-00.db'));
    assert.equal(db.listItems().length, 1);
    assert.equal(db.listItems()[0].title, 'Tarea respaldada');
    // The damaged file is kept as a copy, so the bytes it held are never
    // lost when the recovered copy replaces it.
    const kept = fs.readdirSync(dir).filter((name) => name.startsWith('cybergo.corrupt-'));
    assert.equal(kept.length, 1);
    assert.equal(db.recoveryNote()!.keptAs, kept[0]);
    assert.deepEqual(fs.readFileSync(path.join(dir, kept[0])), garbage);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reloadFromDisk keeps the old handle when the file on disk is corrupt', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea intacta',
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
    db.flush();

    fs.writeFileSync(database, Buffer.from('not a database'));
    assert.equal(db.reloadFromDisk(), false);
    // The old handle is still usable.
    assert.equal(db.listItems().length, 1);
    assert.equal(db.listItems()[0].title, 'Tarea intacta');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing group is reported instead of crashing', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    assert.throws(() => db.saveGroup({ id: 'missing', name: 'No existe', color: '#ffffff' }), /group/);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a reminder that was announced but not shown can fire again', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    const item = db.saveItem({
      kind: 'event',
      title: 'Aviso',
      notes: '',
      allDay: false,
      startLocal: '2026-01-05T10:00',
      endLocal: null,
      importance: 'normal',
      color: '',
      groupId: null,
      recurrence: null,
      remindMinutes: 0,
    });

    // The reminder is announced, so the alert key is stored.
    db.markAlerted([item.id]);
    const announced = db.listItems()[0];
    assert.notEqual(announced.alertKey, null);

    // The window could not be shown, so the key goes back and the reminder
    // fires again instead of staying silent for good.
    db.restoreAlertKeys([{ id: item.id, alertKey: announced.alertKey }]);
    assert.equal(db.listItems()[0].alertKey, announced.alertKey);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a database from a newer build is left untouched', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea de la version nueva',
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
    db.flush();
    db.close();

    // The file claims to come from a build that knows more than this one.
    const handle = await openFile(database);
    handle.run('PRAGMA user_version = 99');
    fs.writeFileSync(database, Buffer.from(handle.export()));
    handle.close();
    const before = fs.readFileSync(database);

    await db.initDatabase(database, wasm, 'en');

    // The file was not rewritten, so nothing this build does not understand
    // was lost.
    assert.deepEqual(fs.readFileSync(database), before);
    assert.equal(db.listItems().length, 1);
    assert.equal(db.listItems()[0].title, 'Tarea de la version nueva');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('changing only the reminder keeps the occurrence the series had reached', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    const item = db.saveItem({
      kind: 'event',
      title: 'Reunion mensual',
      notes: '',
      allDay: false,
      startLocal: '2026-01-05T10:00',
      endLocal: null,
      importance: 'normal',
      color: '',
      groupId: null,
      recurrence: { freq: 'monthly', interval: 1, until: null, dayOfMonth: 5 },
      remindMinutes: 15,
    });

    // The first occurrence is dismissed, so the series moves to February.
    db.dismissItem(item.id);
    const advanced = db.listItems()[0];
    assert.equal(advanced.occurrenceAt, new Date(2026, 1, 5, 10, 0, 0, 0).toISOString());

    // Only the reminder offset changes. The series must stay on February,
    // otherwise it would go back to January and fire for a moment that has
    // already passed.
    db.saveItem({
      id: item.id,
      kind: 'event',
      title: 'Reunion mensual',
      notes: '',
      allDay: false,
      startLocal: '2026-01-05T10:00',
      endLocal: null,
      importance: 'normal',
      color: '',
      groupId: null,
      recurrence: { freq: 'monthly', interval: 1, until: null, dayOfMonth: 5 },
      remindMinutes: 30,
    });

    const updated = db.listItems()[0];
    assert.equal(updated.occurrenceAt, advanced.occurrenceAt);
    // The alert moves with the new offset, half an hour before the same
    // occurrence.
    assert.equal(updated.nextFireAt, new Date(2026, 1, 5, 9, 30, 0, 0).toISOString());
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a database file is checked before it replaces the live one', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');
  const broken = path.join(dir, 'broken.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    db.saveItem({
      kind: 'task',
      title: 'Tarea',
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
    db.flush();

    // A copy that can be opened is a usable backup.
    assert.equal(db.canOpenFile(database), true);

    // A file that is not a database is refused, so it never replaces the
    // live one.
    fs.writeFileSync(broken, Buffer.from('broken bytes'));
    assert.equal(db.canOpenFile(broken), false);
    assert.equal(db.canOpenFile(path.join(dir, 'missing.db')), false);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a group color is only a plain color', async () => {
  const dir = tempDir();
  const database = path.join(dir, 'cybergo.db');

  try {
    await db.initDatabase(database, wasm, 'en');
    // A color that is not one is refused, so it cannot reach the network
    // when it is drawn as a background.
    const group = db.saveGroup({ name: 'Trabajo', color: 'url(http://example.com/x)' });
    assert.equal(group.color, '#6c63e6');
    const real = db.saveGroup({ name: 'Personal', color: '#10b981' });
    assert.equal(real.color, '#10b981');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
