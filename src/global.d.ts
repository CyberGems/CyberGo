import type { CyberGoAPI } from '../electron/preload';

declare global {
  interface Window {
    cyberGoAPI: CyberGoAPI;
  }
}

export {};
