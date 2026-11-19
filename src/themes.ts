import type { ThemeId } from '@shared/types';

export const THEMES: { id: ThemeId; vars: Record<string, string> }[] = [
  {
    // The default face of the app, adapted from the CyberPaste default
    // palette: deep navy surfaces with the steel teal accent that CyberPaste
    // uses for its quiet highlights.
    id: 'cybergo',
    vars: {
      '--bg-app': '#0d0f17',
      '--bg-sidebar': '#10131d',
      '--bg-list': '#131622',
      '--bg-surface': '#1b1f33',
      '--bg-hover': 'rgba(230,240,255,0.06)',
      '--bg-active': 'rgba(58,148,158,0.18)',
      '--bg-input': '#191d2b',
      '--bg-modal': '#171a28',
      '--bg-tooltip': 'rgba(13, 15, 23, 0.97)',
      '--border': '#262d40',
      '--border-strong': '#313a56',
      '--border-focus': '#3a949e',
      '--accent': '#3a949e',
      '--accent-light': '#7ccdd6',
      '--accent-dim': 'rgba(58,148,158,0.16)',
      '--accent-glow': 'rgba(58,148,158,0.20)',
      '--text-primary': '#e6f0ff',
      '--text-secondary': '#a0b4d2',
      '--text-muted': '#6e82a0',
      '--text-on-accent': '#ffffff',
      '--scrollbar-thumb': '#2b3350',
      '--shadow-sm': '0 4px 14px rgba(0,0,0,0.16)',
      '--shadow-md': '0 16px 34px rgba(0,0,0,0.26)',
      '--shadow-lg': '0 26px 70px rgba(0,0,0,0.36)',
      '--danger': '#ff0055',
      '--danger-dim': 'rgba(255,0,85,0.15)',
      '--warning': '#f59e0b',
      '--success': '#22c55e',
      // The tasks kind reads as pending work, not as done, so it keeps its
      // own warm tone instead of borrowing the green of completion.
      '--kind-task': '#f2b34c',
    },
  },
  {
    id: 'gray',
    vars: {
      '--bg-app': '#1a1a1a',
      '--bg-sidebar': '#121212',
      '--bg-list': '#161616',
      '--bg-surface': '#242424',
      '--bg-hover': '#2c2c2c',
      '--bg-active': '#333333',
      '--bg-input': '#121212',
      '--bg-modal': '#1e1e1e',
      '--bg-tooltip': 'rgba(20, 20, 20, 0.97)',
      '--border': '#2d2d2d',
      '--border-strong': '#454545',
      '--border-focus': '#9ca3af',
      '--accent': '#9ca3af',
      '--accent-light': '#d1d5db',
      '--accent-dim': 'rgba(156,163,175,0.15)',
      '--accent-glow': 'rgba(156,163,175,0.20)',
      '--text-primary': '#f9fafb',
      '--text-secondary': '#c9d1d9',
      '--text-muted': '#9aa3ad',
      '--text-on-accent': '#111111',
      '--scrollbar-thumb': '#3a3a3a',
      '--shadow-sm': '0 4px 14px rgba(0,0,0,0.18)',
      '--shadow-md': '0 16px 34px rgba(0,0,0,0.3)',
      '--shadow-lg': '0 26px 70px rgba(0,0,0,0.42)',
      '--danger': '#f87171',
      '--danger-dim': 'rgba(248,113,113,0.16)',
      '--warning': '#d1d5db',
      '--success': '#d1d5db',
      '--kind-task': '#d1d5db',
    },
  },
  {
    id: 'light',
    vars: {
      '--bg-app': '#f4f5f9',
      '--bg-sidebar': '#e8eaf2',
      '--bg-list': '#ffffff',
      '--bg-surface': '#ffffff',
      '--bg-hover': '#f0f2f6',
      '--bg-active': '#e4e2f4',
      '--bg-input': '#f0f2f6',
      '--bg-modal': '#ffffff',
      '--bg-tooltip': 'rgba(255, 255, 255, 0.98)',
      '--border': '#d8dae0',
      '--border-strong': '#b9bdc8',
      '--border-focus': '#6a60a0',
      '--accent': '#6a60a0',
      '--accent-light': '#8a80b8',
      '--accent-dim': 'rgba(106,96,160,0.10)',
      '--accent-glow': 'rgba(106,96,160,0.12)',
      '--text-primary': '#1a1a2e',
      '--text-secondary': '#5a5a72',
      '--text-muted': '#7a7a90',
      '--text-on-accent': '#ffffff',
      '--scrollbar-thumb': '#c8cad0',
      '--shadow-sm': '0 4px 14px rgba(38,42,58,0.08)',
      '--shadow-md': '0 16px 34px rgba(38,42,58,0.12)',
      '--shadow-lg': '0 26px 70px rgba(38,42,58,0.18)',
      '--danger': '#dc2626',
      '--danger-dim': 'rgba(220,38,38,0.10)',
      '--warning': '#b45309',
      '--success': '#15803d',
      '--kind-task': '#b45309',
    },
  },
];

let appliedThemeId: string | null = null;

export function applyTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  // Rewriting every custom property invalidates the whole style tree, so the
  // theme is only applied when it actually changes.
  if (appliedThemeId === theme.id) return;
  appliedThemeId = theme.id;
  for (const [key, value] of Object.entries(theme.vars)) {
    document.documentElement.style.setProperty(key, value);
  }
  document.documentElement.style.colorScheme = theme.id === 'light' ? 'light' : 'dark';
  localStorage.setItem('cybergo-theme', theme.id);
}
