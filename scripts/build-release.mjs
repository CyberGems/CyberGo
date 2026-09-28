import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = path.join(os.tmpdir(), `CyberGo-pre-release-${version}-${Date.now()}`);
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');

execFileSync(process.execPath, [builderCli, `--config.directories.output=${output}`], {
  cwd: root,
  stdio: 'inherit',
});

console.log(`Pre-release artifacts written to ${output}`);
