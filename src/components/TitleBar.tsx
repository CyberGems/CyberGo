import { useEffect, useState, type ReactNode } from 'react';
import { Minus, X } from 'lucide-react';
import Tooltip from './Tooltip';

/** The icon of a window that fills the screen. */
function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

/** The icon of a window that can go back to its size. */
function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  );
}

export default function TitleBar({
  title,
  children,
  onClose,
  windowLabels,
  hideBrand = false,
}: {
  title: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  windowLabels: {
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
  };
  /** The lock screen shows the name of the app in the middle, so the bar stays empty. */
  hideBrand?: boolean;
}) {
  const api = window.cyberGoAPI;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let alive = true;
    api.isMaximized?.()
      .then((value) => { if (alive) setMaximized(value); })
      .catch(() => {});
    const off = api.onMaximized?.((value) => setMaximized(value));
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  return (
    <header className="titlebar">
      {!hideBrand && (
        <div className="drag">
          <div className="brand">{title}</div>
        </div>
      )}
      {hideBrand && <div className="drag" />}
      {children}
      <div className="win-controls">
        <Tooltip label={windowLabels.minimize} placement="bottom">
          <button className="win-btn" onClick={() => api.minimize()} aria-label={windowLabels.minimize}><Minus size={14} /></button>
        </Tooltip>
        <Tooltip label={maximized ? windowLabels.restore : windowLabels.maximize} placement="bottom">
          <button
            className="win-btn"
            onClick={() => api.toggleMaximize()}
            aria-label={maximized ? windowLabels.restore : windowLabels.maximize}
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
        </Tooltip>
        <Tooltip label={windowLabels.close} placement="bottom">
          <button className="win-btn close" onClick={() => (onClose ? onClose() : api.close())} aria-label={windowLabels.close}><X size={14} /></button>
        </Tooltip>
      </div>
    </header>
  );
}
