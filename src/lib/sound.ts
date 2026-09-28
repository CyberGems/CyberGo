let audio: HTMLAudioElement | null = null;

export function fileUrl(filePath: string): string {
  if (filePath.startsWith('file:') || filePath.startsWith('http')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  return encodeURI(normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`);
}

export function builtInSoundUrl() {
  return new URL('sounds/chime.wav', window.location.href).toString();
}

export async function playAlert(filePath?: string) {
  const file = filePath ?? await window.cyberGoAPI.soundPath();
  if (!audio) audio = new Audio();
  audio.src = fileUrl(file);
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch {
    /* autoplay can fail until the window has been clicked */
  }
}

export function stopAlert() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
