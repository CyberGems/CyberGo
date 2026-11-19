import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, Bell, BookOpen, ChevronDown, ClipboardCopy, Download, Globe, Heart, HelpCircle, Info, Lock, Minus, MoreHorizontal, Power, Tag, X, Zap } from 'lucide-react';
import type { Copy } from '../i18n';
import { platformLabel } from '../lib/format';
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
      <polyline points="4 14 10 14" />
      <polyline points="20 10 14 10" />
      <polyline points="14 4 14 10" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  );
}

const DONATE_URL = 'https://github.com/CyberGems/CyberGo#%EF%B8%8F-donate';

type MoreSectionId = 'actions' | 'help';

type MoreRow =
  | { id: string; icon: ReactNode; label: string; shortcut?: string; run: () => void }
  | { id: string; divider: true };

export default function TitleBar({
  title,
  children,
  onClose,
  windowLabels,
  hideBrand = false,
  onBrandClick,
  brandLabel,
  menuLabels,
  lockAvailable = false,
  onOpenAbout,
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
  /** When set, the brand becomes a button that opens the About dialog. */
  onBrandClick?: () => void;
  /** The accessible name and tooltip of that brand button. */
  brandLabel?: string;
  /** When set, the title bar carries the More menu, with its strings. */
  menuLabels?: Copy;
  /** The lock action needs a password to exist. */
  lockAvailable?: boolean;
  onOpenAbout?: () => void;
}) {
  const api = window.cyberGoAPI;
  const [maximized, setMaximized] = useState(false);
  /** The tag of the newest release when it beats this build, else null. */
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const [flyout, setFlyout] = useState<MoreSectionId | null>(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const flyoutRef = useRef<HTMLDivElement>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // The update badge starts from the cached check and then follows every
  // silent check the main process completes.
  useEffect(() => {
    let alive = true;
    api.checkUpdates()
      .then((result) => { if (alive && result.available) setUpdateVersion(result.latest); })
      .catch(() => {});
    const off = api.onUpdatesStatus?.((result) => setUpdateVersion(result.available ? result.latest : null));
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  function openMenu() {
    const rect = burgerRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  }

  function toggleMenu() {
    setMenuOpen((prev) => {
      if (prev) return false;
      openMenu();
      return true;
    });
  }

  function clearFlyoutTimer() {
    if (flyoutTimer.current) {
      clearTimeout(flyoutTimer.current);
      flyoutTimer.current = null;
    }
  }

  function openFlyoutFor(section: MoreSectionId, trigger: HTMLElement, focusFirst = false) {
    clearFlyoutTimer();
    const rect = trigger.getBoundingClientRect();
    const width = 240;
    const gap = 6;
    const margin = 8;
    // Windows style: open towards the right when it fits, otherwise flip left.
    const spaceRight = window.innerWidth - rect.right - gap - margin;
    const spaceLeft = rect.left - gap - margin;
    let left: number;
    if (spaceRight >= width) left = rect.right + gap;
    else if (spaceLeft >= width) left = rect.left - gap - width;
    else left = spaceRight >= spaceLeft ? Math.max(margin, window.innerWidth - width - margin) : margin;
    setFlyoutPos({ top: Math.max(8, Math.min(rect.top - 6, window.innerHeight - 140)), left });
    setFlyout(section);
    if (focusFirst) requestAnimationFrame(() => flyoutRef.current?.querySelector<HTMLElement>('button')?.focus());
  }

  function closeFlyout(refocus = false) {
    clearFlyoutTimer();
    if (!flyout) return false;
    if (refocus) menuRef.current?.querySelector<HTMLElement>(`[data-section="${flyout}"]`)?.focus();
    setFlyout(null);
    return true;
  }

  function scheduleFlyoutOpen(section: MoreSectionId, trigger: HTMLElement) {
    clearFlyoutTimer();
    if (flyout === section) return;
    flyoutTimer.current = setTimeout(() => openFlyoutFor(section, trigger), 120);
  }

  function scheduleFlyoutClose() {
    clearFlyoutTimer();
    flyoutTimer.current = setTimeout(() => setFlyout(null), 220);
  }

  /** Copies the same diagnostics block the About dialog offers. */
  async function copyDiagnostics() {
    try {
      const info = await api.getAppInfo();
      const lines = [
        `CyberGo ${info.version}`,
        `Electron: ${info.electron}`,
        `Chrome: ${info.chrome}`,
        `Node: ${info.node}`,
        `OS: ${platformLabel(info.platform)} ${info.osRelease} (${info.arch})`,
      ];
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      /* Clipboard access is optional. */
    }
  }

  // The menu closes on Escape and on any press outside of it; the arrows walk
  // the items and the section headers open their flyout with ArrowRight.
  useEffect(() => {
    if (!menuOpen) return;
    function focusMenuItem(direction: 1 | -1 | 0) {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button.menu-item, button.more-menu-section-toggle') ?? [])
        .filter((item) => !item.disabled && item.offsetParent !== null);
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = direction === 0 ? 0 : (current + direction + items.length) % items.length;
      items[next]?.focus();
    }
    focusMenuItem(0);
    function onKey(event: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (closeFlyout(true)) return;
        setMenuOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowRight' && active?.classList.contains('more-menu-section-toggle')) {
        event.preventDefault();
        openFlyoutFor(active.dataset.section as MoreSectionId, active, true);
        return;
      }
      if (event.key === 'ArrowLeft' && flyoutRef.current?.contains(active)) {
        event.preventDefault();
        closeFlyout(true);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusMenuItem(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusMenuItem(-1);
      }
    }
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (burgerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuOpen, flyout]);

  useEffect(() => () => {
    clearFlyoutTimer();
  }, []);

  // Alt+M opens and closes the menu, the suite shortcut.
  useEffect(() => {
    function onMenuShortcut(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'm') return;
      event.preventDefault();
      setMenuOpen((prev) => {
        if (prev) return false;
        openMenu();
        return true;
      });
    }
    window.addEventListener('keydown', onMenuShortcut);
    return () => window.removeEventListener('keydown', onMenuShortcut);
  }, []);

  if (!menuLabels) {
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

  const labels = menuLabels;
  const sections: { id: MoreSectionId; label: string; rows: MoreRow[] }[] = [
    {
      id: 'actions',
      label: labels.sectionActions,
      rows: [
        {
          id: 'quick',
          icon: <Zap size={14} />,
          label: labels.quickAddLabel,
          shortcut: labels.quickShortcut,
          run: () => { setMenuOpen(false); window.dispatchEvent(new Event('cybergo:focus-quick')); },
        },
        {
          id: 'reminders',
          icon: <Bell size={14} />,
          label: labels.reminders,
          run: () => { setMenuOpen(false); void api.toggleReminders(); },
        },
      ],
    },
    {
      id: 'help',
      label: labels.sectionHelp,
      rows: [
        { id: 'docs', icon: <BookOpen size={14} />, label: labels.helpDocs, run: () => { setMenuOpen(false); void api.openExternal('https://github.com/CyberGems/CyberGo/wiki'); } },
        { id: 'faq', icon: <HelpCircle size={14} />, label: labels.helpFaq, run: () => { setMenuOpen(false); void api.openExternal('https://github.com/CyberGems/CyberGo/wiki/FAQ'); } },
        { id: 'changelog', icon: <Tag size={14} />, label: labels.helpChangelog, run: () => { setMenuOpen(false); void api.openExternal('https://github.com/CyberGems/CyberGo/releases'); } },
        { id: 'website', icon: <Globe size={14} />, label: labels.helpWebsite, run: () => { setMenuOpen(false); void api.openExternal('https://cybergems.org/apps/cybergo/'); } },
        { id: 'diagnostics', icon: <ClipboardCopy size={14} />, label: labels.about.copyDiagnostics, run: () => { setMenuOpen(false); void copyDiagnostics(); } },
        { id: 'help-divider', divider: true },
        { id: 'about', icon: <Info size={14} />, label: labels.aboutEntry, run: () => { setMenuOpen(false); onOpenAbout?.(); } },
        { id: 'updates', icon: <Download size={14} />, label: labels.about.checkUpdates, run: () => { setMenuOpen(false); onOpenAbout?.(); } },
      ],
    },
  ];

  function renderRow(row: MoreRow) {
    if ('divider' in row) return <div key={row.id} className="more-menu-divider" />;
    return (
      <button key={row.id} type="button" className="menu-item" onClick={row.run}>
        {row.icon}
        <span style={{ flex: 1 }}>{row.label}</span>
        {row.shortcut && <span className="more-menu-shortcut">{row.shortcut}</span>}
      </button>
    );
  }

  return (
    <header className="titlebar">
      {!hideBrand && onBrandClick && (
        <div className="drag">
          <Tooltip label={brandLabel ?? ''} placement="bottom">
            <button type="button" className="brand brand-btn" onClick={onBrandClick} aria-label={brandLabel ?? undefined}>
              <img className="brand-icon" src="icon.png" alt="" draggable={false} />
              <span className="brand-text">{title}</span>
            </button>
          </Tooltip>
        </div>
      )}
      {!hideBrand && !onBrandClick && (
        <div className="drag">
          <div className="brand">{title}</div>
        </div>
      )}
      {hideBrand && <div className="drag" />}
      {children}
      <div style={{ position: 'relative', display: 'flex' }}>
        {updateVersion && (
          <Tooltip label={labels.about.updateAvailable.replace('{version}', updateVersion.replace(/^v/, ''))} placement="bottom">
            <button
              type="button"
              className="titlebar-update-button"
              aria-label={labels.about.updateAvailable.replace('{version}', updateVersion.replace(/^v/, ''))}
              onClick={() => onOpenAbout?.()}
            >
              <ArrowDown size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        <Tooltip label={labels.moreOptions} placement="bottom">
          <button
            type="button"
            ref={burgerRef}
            className={`btn-icon${menuOpen ? ' is-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={labels.moreMenuLabel}
            onClick={toggleMenu}
          >
            <MoreHorizontal size={14} />
          </button>
        </Tooltip>

        {menuOpen && createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={labels.moreMenuLabel}
            className="more-menu"
            style={{ top: menuPos.top, right: menuPos.right, maxHeight: `calc(100vh - ${menuPos.top + 8}px)` }}
          >
            {/* Donate goes first, the convention of the suite. */}
            <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); void api.openExternal(DONATE_URL); }}>
              <Heart size={14} style={{ color: '#F43F5E' }} fill="currentColor" stroke="none" />
              <span>{labels.donate}</span>
            </button>
            <div className="more-menu-divider" />
            {sections.map((section, index) => (
              <Fragment key={section.id}>
                {index > 0 && <div className="more-menu-divider" />}
                <button
                  type="button"
                  role="menuitem"
                  data-section={section.id}
                  className={`more-menu-section-toggle${flyout === section.id ? ' is-open' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={flyout === section.id}
                  onClick={(event) => openFlyoutFor(section.id, event.currentTarget)}
                  onMouseEnter={(event) => scheduleFlyoutOpen(section.id, event.currentTarget)}
                  onMouseLeave={scheduleFlyoutClose}
                >
                  <span>{section.label}</span>
                  <ChevronDown size={13} aria-hidden="true" />
                </button>
              </Fragment>
            ))}
            <div className="more-menu-divider" />
            <button
              type="button"
              className="menu-item"
              disabled={!lockAvailable}
              onClick={() => { setMenuOpen(false); void api.lock(); }}
            >
              <Lock size={14} />
              <span>{lockAvailable ? labels.lock : labels.lockUnavailable}</span>
            </button>
            <div className="more-menu-divider" />
            <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); void api.close(); }}>
              <Power size={14} style={{ color: 'var(--danger)' }} />
              <span>{labels.exitApp}</span>
            </button>
          </div>,
          document.body
        )}

        {menuOpen && flyout && createPortal(
          <div
            ref={flyoutRef}
            role="menu"
            aria-label={sections.find((section) => section.id === flyout)?.label}
            className="more-menu"
            style={{ top: flyoutPos.top, left: flyoutPos.left, maxHeight: `calc(100vh - ${flyoutPos.top + 8}px)` }}
            onMouseEnter={clearFlyoutTimer}
            onMouseLeave={scheduleFlyoutClose}
          >
            {sections.find((section) => section.id === flyout)?.rows.map(renderRow)}
          </div>,
          document.body
        )}
      </div>
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
