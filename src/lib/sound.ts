let audio: HTMLAudioElement | null = null;

export function fileUrl(filePath: string): string {
  if (filePath.startsWith('file:') || filePath.startsWith('http')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  return encodeURI(normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`);
}

export async function playAlert() {
  const file = await window.cyberGoAPI.soundPath();
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
