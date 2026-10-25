// Fetch the reviewed shared synchronizer; app icons still come from current official sources.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revision = '80266c5b4ad7fa4c5768e2543a4c7c7a461fc8f7';
const sources = [
  ['Sync-SuiteIcons.ps1', 'b34b355d9cf8d522cbbb1cb2ac02fe31fc9fd7b5d9c1043264d2062822a7fbf0'],
  ['SuiteIconSources.json', '79ce8a6786e01ac205a26bc6f71f679a7e1e849c7d2638cabff3d5d8cd0b7778'],
];
const scratch = await mkdtemp(path.join(tmpdir(), 'CyberGo-suite-icons-'));
try {
  const scripts = path.join(scratch, 'scripts');
  await mkdir(scripts);
  for (const [file, expectedHash] of sources) {
    const response = await fetch(`https://raw.githubusercontent.com/CyberGems/CyberSnap/${revision}/scripts/${file}`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
      throw new Error(`${file}: shared synchronizer integrity check failed`);
    }
    await writeFile(path.join(scripts, file), bytes);
  }
  execFileSync('pwsh', ['-NoProfile', '-File', path.join(scripts, 'Sync-SuiteIcons.ps1'), '-RepositoryRoot', root, '-ReportPath', path.join(scratch, 'report.json')], { cwd: root, stdio: 'inherit' });
} finally {
  // Only this invocation's unique temporary directory is removed.
  if (path.dirname(path.resolve(scratch)) !== path.resolve(tmpdir()) || !path.basename(scratch).startsWith('CyberGo-suite-icons-')) {
    throw new Error('Refusing to remove a directory outside the synchronization temporary folder');
  }
  await rm(scratch, { recursive: true, force: true });
}
