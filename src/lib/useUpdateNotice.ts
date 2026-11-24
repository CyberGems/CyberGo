import { useCallback, useEffect, useRef, useState } from 'react';
import type { UpdateCheck } from '@shared/types';

const SKIPPED_VERSION_KEY = 'cybergo-skipped-update';

export interface UpdateOffer {
  release: UpdateCheck & { latest: string };
  phase: 'available' | 'downloading' | 'ready' | 'installing';
  percent: number;
  cancelling?: boolean;
  error?: 'download' | 'install' | 'cancel' | 'github';
}

export function useUpdateNotice(notifications: boolean, unlocked: boolean) {
  const api = window.cyberGoAPI;
  const current = useRef<UpdateOffer | null>(null);
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const manualChecks = useRef(0);
  const announced = useRef<string | null>(null);

  const store = useCallback((value: UpdateOffer | null) => {
    current.current = value;
    setOffer(value);
  }, []);

  const accept = useCallback((release: UpdateCheck, manual: boolean) => {
    if (release.error) return;
    const previous = current.current;
    if (previous && previous.phase !== 'available') {
      if (manual && release.available) setOpen(true);
      return;
    }
    const tag = release.latest;
    if (!release.available || !tag) {
      store(null);
      setFocusOnOpen(false);
      setOpen(false);
      return;
    }
    if (!manual && localStorage.getItem(SKIPPED_VERSION_KEY) === tag.replace(/^v/i, '')) return;
    store({
      release: { ...release, latest: tag },
      phase: release.downloaded ? 'ready' : 'available',
      percent: 0,
      error: previous?.release.latest === tag ? previous.error : undefined,
    });
    if (manual || announced.current !== tag) setOpen(true);
    announced.current = tag;
  }, [store]);

  useEffect(() => {
    if (!notifications || !unlocked) return;
    let alive = true;
    const handle = (release: UpdateCheck) => {
      if (alive && manualChecks.current === 0) accept(release, false);
    };
    const stop = api.onUpdatesStatus(handle);
    void api.checkUpdates().then(handle).catch(() => {});
    return () => { alive = false; stop(); };
  }, [accept, api, notifications, unlocked]);

  const checkManually = useCallback(async () => {
    manualChecks.current += 1;
    try {
      const result = await api.checkUpdates(true);
      accept(result, true);
      return result;
    } finally {
      manualChecks.current -= 1;
    }
  }, [accept, api]);

  useEffect(() => api.onUpdateProgress((tag, percent) => {
    const pending = current.current;
    if (pending?.phase === 'downloading' && pending.release.latest === tag) store({ ...pending, percent });
  }), [api, store]);

  function skip() {
    const pending = current.current;
    if (pending?.phase !== 'available') return;
    localStorage.setItem(SKIPPED_VERSION_KEY, pending.release.latest.replace(/^v/i, ''));
    store(null);
    hide();
  }

  function show() {
    setFocusOnOpen(true);
    setOpen(true);
  }

  function hide() {
    setFocusOnOpen(false);
    setOpen(false);
  }

  async function download() {
    const pending = current.current;
    if (pending?.phase !== 'available' || !pending.release.canInstall) return;
    store({ ...pending, phase: 'downloading', percent: 0, error: undefined });
    const result = await api.downloadUpdate(pending.release.latest).catch(() => 'failed' as const);
    store({
      release: pending.release,
      phase: result === 'ready' ? 'ready' : 'available',
      percent: result === 'ready' ? 100 : 0,
      error: result === 'failed' ? 'download' : undefined,
    });
    if (result !== 'cancelled') setOpen(true);
  }

  async function cancel() {
    const pending = current.current;
    if (pending?.phase !== 'downloading' || pending.cancelling) return;
    store({ ...pending, cancelling: true });
    try {
      await api.cancelUpdateDownload(pending.release.latest);
    } catch {
      const latest = current.current;
      if (latest?.phase === 'downloading') store({ ...latest, cancelling: false, error: 'cancel' });
    }
  }

  async function install() {
    const pending = current.current;
    if (pending?.phase !== 'ready') return;
    store({ ...pending, phase: 'installing', error: undefined });
    const result = await api.installUpdate(pending.release.latest).catch(() => ({ ok: false, downloaded: true }));
    if (!result.ok) store({ ...pending, phase: result.downloaded ? 'ready' : 'available', error: 'install' });
  }

  async function openGitHub() {
    const pending = current.current;
    if (pending?.phase !== 'available') return;
    const base = 'https://github.com/CyberGems/CyberGo/releases';
    const url = base + '/tag/' + encodeURIComponent(pending.release.latest);
    if (!await api.openExternal(url).catch(() => false) && current.current === pending) {
      store({ ...pending, error: 'github' });
    }
  }

  return { offer, open, focusOnOpen, show, hide, checkManually, skip, download, cancel, install, openGitHub };
}
