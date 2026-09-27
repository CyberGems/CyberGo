import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as db from './db';

test('access log can be disabled, cleared, and is retained to 100 entries', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cybergo-db-test-'));
  const database = path.join(dir, 'cybergo.db');
  const wasm = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));

  try {
    await db.initDatabase(database, wasm, 'en');
    assert.equal(db.readSettings('en').accessLogEnabled, true);

    db.recordAccessEvent('failure', 'password');
    db.recordAccessEvent('success', 'password');
    assert.deepEqual(db.listAccessLog().map((entry) => entry.event), ['success', 'failure']);

    db.applySettingsPatch({ accessLogEnabled: false });
    db.reloadFromDisk();
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
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
