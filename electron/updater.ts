import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, open, rename, rm } from 'fs/promises';
import path from 'path';

const RELEASES_URL = 'https://github.com/CyberGems/CyberGo/releases';
const CHECKSUM_FILE = 'SHA256SUMS.txt';

export interface ReleaseInstaller {
  tag: string;
  name: string;
  size: number;
  digest: string | null;
  hasChecksumFile: boolean;
}

export function findReleaseInstaller(tag: string, assets: unknown): ReleaseInstaller | undefined {
  if (!/^v?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(tag) || !Array.isArray(assets)) return;
  const name = 'CyberGo.Setup.' + tag.replace(/^v/, '') + '.exe';
  const installer = assets.find((asset) => asset?.name === name && asset.state !== 'new');
  if (!installer || !Number.isSafeInteger(installer.size) || installer.size <= 0) return;
  const digest = typeof installer.digest === 'string' ? installer.digest.match(/^sha256:([0-9a-f]{64})$/i)?.[1].toLowerCase() ?? null : null;
  const hasChecksumFile = assets.some((asset) => asset?.name === CHECKSUM_FILE && asset.state !== 'new');
  if (digest || hasChecksumFile) return { tag, name, size: installer.size, digest, hasChecksumFile };
}

export function launchInstaller(installer: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // The assisted NSIS installer skips its welcome page for an update and
    // offers to run CyberGo when it finishes.
    const child = spawn(installer, ['--updated'], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export class UpdateInstaller {
  private readonly installerPath: string;
  private readonly partialPath: string;
  private ready: { tag: string; digest: string } | null = null;
  private busy = false;
  private transfer: { tag: string; controller: AbortController } | null = null;

  constructor(
    private readonly directory: string,
    private readonly fetch: (url: string, init?: RequestInit) => Promise<Response>,
    private readonly launch = launchInstaller,
  ) {
    this.installerPath = path.join(directory, 'CyberGo.Update.exe');
    this.partialPath = path.join(directory, 'CyberGo.Update.download');
  }

  isDownloaded(tag: string): boolean {
    return this.ready?.tag === tag;
  }

  cancelDownload(tag: string): boolean {
    if (this.transfer?.tag !== tag) return false;
    this.transfer.controller.abort();
    return true;
  }

  private async expectedDigest(update: ReleaseInstaller, signal: AbortSignal): Promise<string> {
    if (update.digest) return update.digest;
    if (!update.hasChecksumFile) throw new Error('Missing update checksum');

    const url = RELEASES_URL + '/download/' + encodeURIComponent(update.tag) + '/' + CHECKSUM_FILE;
    const response = await this.fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
    if (!response.ok) throw new Error('Update checksum could not be downloaded');
    const lines = (await response.text()).split(/\r?\n/);
    for (const line of lines) {
      const entry = line.match(/^([0-9a-f]{64}) [ *](.+)$/i);
      if (entry && entry[2] === update.name) return entry[1].toLowerCase();
    }
    throw new Error('The update checksum is missing from the release');
  }

  async download(update: ReleaseInstaller, progress: (percent: number) => void): Promise<void> {
    if (this.busy) throw new Error('An update action is already in progress');
    if (this.isDownloaded(update.tag)) return;

    this.busy = true;
    const controller = new AbortController();
    const { signal } = controller;
    this.transfer = { tag: update.tag, controller };
    try {
      const digest = await this.expectedDigest(update, signal);
      signal.throwIfAborted();
      const url = RELEASES_URL + '/download/' + encodeURIComponent(update.tag) + '/' + encodeURIComponent(update.name);
      await mkdir(this.directory, { recursive: true });
      await rm(this.partialPath, { force: true });
      const file = await open(this.partialPath, 'wx');
      try {
        const response = await this.fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10 * 60_000)]) });
        if (!response.ok || !response.body) throw new Error('The installer could not be downloaded');
        const reader = response.body.getReader();
        const hash = createHash('sha256');
        let bytes = 0;
        let percent = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            signal.throwIfAborted();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > update.size) throw new Error('The installer exceeds the size in the release');
            hash.update(value);
            await file.writeFile(value);
            const next = Math.floor(bytes * 99 / update.size);
            if (next > percent) {
              percent = next;
              progress(percent);
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }

        if (bytes !== update.size || hash.digest('hex') !== digest) {
          throw new Error('The installer failed its SHA-256 check');
        }
      } finally {
        await file.close();
      }
      signal.throwIfAborted();
      // Once verification passes, publish the staged package atomically.
      this.transfer = null;
      await rename(this.partialPath, this.installerPath);
      this.ready = { tag: update.tag, digest };
      progress(100);
    } catch (error) {
      if (signal.aborted) signal.throwIfAborted();
      throw error;
    } finally {
      await rm(this.partialPath, { force: true }).catch(() => {});
      this.transfer = null;
      this.busy = false;
    }
  }

  async install(tag: string): Promise<void> {
    if (this.busy || this.ready?.tag !== tag) throw new Error('The requested update is not ready');
    this.busy = true;
    const ready = this.ready;
    this.ready = null;
    try {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(this.installerPath)) hash.update(chunk);
      if (hash.digest('hex') !== ready.digest) throw new Error('The installer failed its SHA-256 check');
      try {
        await this.launch(this.installerPath);
      } catch (error) {
        this.ready = ready;
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }
}
