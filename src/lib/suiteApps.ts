// Published sister apps shown in About. Icons are bundled for offline use.
export const suiteApps = [
  { slug: 'cyberclock', name: 'CyberClock', site: 'https://cybergems.org/apps/cyberclock/' },
  { slug: 'cyberfeeds', name: 'CyberFeeds', site: 'https://cybergems.org/apps/cyberfeeds/' },
  { slug: 'cyberlauncher', name: 'CyberLauncher', site: 'https://cybergems.org/apps/cyberlauncher/' },
  { slug: 'cybermanager', name: 'CyberManager', site: 'https://cybergems.org/apps/cybermanager/' },
  { slug: 'cybernotes', name: 'CyberNotes', site: 'https://cybergems.org/apps/cybernotes/' },
  { slug: 'cyberpaste', name: 'CyberPaste', site: 'https://cybergems.org/apps/cyberpaste/' },
  { slug: 'cybersnap', name: 'CyberSnap', site: 'https://cybergems.org/apps/cybersnap/' },
  { slug: 'cybertray', name: 'CyberTray', site: 'https://cybergems.org/apps/cybertray/' },
  { slug: 'cyberviewer', name: 'CyberViewer', site: 'https://cybergems.org/apps/cyberviewer/' },
  { slug: 'cyberwall', name: 'CyberWall', site: 'https://cybergems.org/apps/cyberwall/' },
] as const;

export function pickSuiteApps(count = 5) {
  const pool = [...suiteApps];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
