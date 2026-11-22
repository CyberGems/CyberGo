import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { findReleaseInstaller, UpdateInstaller } from './updater';

const tag = 'v0.2.0-alpha.1';
const name = 'CyberGo.Setup.0.2.0-alpha.1.exe';
const payload = Buffer.from('test installer contents');
const digest = createHash('sha256').update(payload).digest('hex');
const asset = { name, size: payload.length, digest: 'sha256:' + digest };
const checksum = { name: 'SHA256SUMS.txt' };

async function updateDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'cybergo-updater-test-'));
  t.after(async () => {
    await rm(path.join(directory, 'CyberGo.Update.exe'), { force: true });
    await rm(path.join(directory, 'CyberGo.Update.download'), { force: true });
    await rmdir(directory);
  });
  return directory;
}

test('uses the installer for the exact release tag with a checksum', () => {
  const packageInfo = findReleaseInstaller(tag, [{ ...asset, name: 'unrelated.exe' }, asset]);
  assert.equal(packageInfo?.name, name);
  assert.equal(packageInfo?.digest, digest);
  assert.equal(findReleaseInstaller('../0.2.0', [asset]), undefined);
  assert.equal(findReleaseInstaller(tag, [{ ...asset, digest: null }]), undefined);
  assert.equal(findReleaseInstaller(tag, [{ ...asset, state: 'new' }, checksum]), undefined);
});

test('downloads before installing and retains the package for a launch retry', async (t) => {
  const directory = await updateDirectory(t);
  const packageInfo = findReleaseInstaller(tag, [{ ...asset, digest: null }, checksum]);
  assert(packageInfo);
  let launches = 0;
  const requests: string[] = [];
  const updater = new UpdateInstaller(directory, async (input) => {
    requests.push(String(input));
    if (String(input).endsWith('/SHA256SUMS.txt')) {
      return new Response(digest + '  ' + name + '\r\n');
    }
    return new Response(payload);
  }, async (installer) => {
    assert.deepEqual(await readFile(installer), payload);
    if (++launches === 1) throw new Error('Test installer did not start');
  });

  const progress: number[] = [];
  await updater.download(packageInfo, (percent) => progress.push(percent));
  assert.deepEqual(progress, [99, 100]);
  assert.deepEqual(requests, [
    'https://github.com/CyberGems/CyberGo/releases/download/' + tag + '/SHA256SUMS.txt',
    'https://github.com/CyberGems/CyberGo/releases/download/' + tag + '/' + name,
  ]);
  assert.equal(launches, 0);
  await assert.rejects(updater.install('v0.2.0-alpha.2'), /not ready/);
  await assert.rejects(updater.install(tag), /did not start/);
  assert.equal(updater.isDownloaded(tag), true);
  await updater.install(tag);
  assert.equal(launches, 2);
  assert.equal(updater.isDownloaded(tag), false);
  assert.equal(requests.length, 2);
});

test('rejects a corrupt download and a modified staged installer', async (t) => {
  const directory = await updateDirectory(t);
  const packageInfo = findReleaseInstaller(tag, [asset]);
  assert(packageInfo);
  const damaged = Buffer.alloc(payload.length, 1);
  let download = damaged;
  const updater = new UpdateInstaller(directory, async () => new Response(download), async () => {
    assert.fail('Unverified installer was launched');
  });

  await assert.rejects(updater.download(packageInfo, () => {}), /SHA-256/);
  assert.equal(updater.isDownloaded(tag), false);
  await assert.rejects(readFile(path.join(directory, 'CyberGo.Update.download')), { code: 'ENOENT' });
  download = payload;
  await updater.download(packageInfo, () => {});
  await writeFile(path.join(directory, 'CyberGo.Update.exe'), damaged);
  await assert.rejects(updater.install(tag), /SHA-256/);
  assert.equal(updater.isDownloaded(tag), false);
});
