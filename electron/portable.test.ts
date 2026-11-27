import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { isPortableBuild, portableExecutableFile, portableUserDataPath } from './portable';

const keys = ['PORTABLE_EXECUTABLE_DIR', 'PORTABLE_EXECUTABLE_FILE'] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('portable paths', () => {
  it('leaves installed builds on the normal userData path', () => {
    delete process.env.PORTABLE_EXECUTABLE_DIR;
    delete process.env.PORTABLE_EXECUTABLE_FILE;
    assert.equal(isPortableBuild(), false);
    assert.equal(portableUserDataPath(), null);
    assert.equal(portableExecutableFile(), '');
  });

  it('keeps portable data beside the executable', () => {
    const directory = path.join('apps', 'CyberGo');
    const executable = path.join(directory, 'CyberGo.exe');
    process.env.PORTABLE_EXECUTABLE_DIR = directory;
    process.env.PORTABLE_EXECUTABLE_FILE = executable;
    assert.equal(isPortableBuild(), true);
    assert.equal(portableUserDataPath(), path.join(directory, 'data'));
    assert.equal(portableExecutableFile(), executable);
  });
});
