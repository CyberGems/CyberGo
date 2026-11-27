import path from 'path';

// electron-builder sets these variables only for its portable target.
export function isPortableBuild(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

// In portable mode process.execPath points at the copy extracted into %TEMP%.
// Auto-launch must use the executable the user actually clicked instead.
export function portableExecutableFile(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || '';
}

// Portable data lives in a `data` folder beside the executable so the whole
// setup can travel together. Installed builds keep using the normal userData.
export function portableUserDataPath(): string | null {
  const directory = process.env.PORTABLE_EXECUTABLE_DIR;
  return directory ? path.join(directory, 'data') : null;
}
