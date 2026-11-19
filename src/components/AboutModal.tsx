import { useEffect, useRef, useState } from 'react';
import { BookOpen, Bug, Check, ClipboardCopy, Download, Gem, Github, Heart, RefreshCw, Tag, X } from 'lucide-react';
import type { AppInfo } from '@shared/types';
import type { Copy } from '../i18n';
import { platformLabel } from '../lib/format';
import { useFocusTrap } from './Dialog';
import Tooltip from './Tooltip';
import { pickSuiteApps } from '../lib/suiteApps';

const REPO_URL = 'https://github.com/CyberGems/CyberGo';
// The app page of the site is not published yet, so the link goes to the
// home of the suite, which is always there.
const SITE_URL = 'https://cybergems.org';
const WIKI_URL = `${REPO_URL}/wiki`;
const ISSUES_URL = `${REPO_URL}/issues`;
const RELEASES_URL = `${REPO_URL}/releases`;
const DONATE_URL = `${REPO_URL}#%EF%B8%8F-donate`;
const DONATE_HEART = '#F43F5E';
const AUTO_CHECK_KEY = 'cybergo-about-autocheck';

type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest' }
  | { state: 'available'; latest: string; url: string | null }
  | { state: 'error' };

export default function AboutModal({
  copy,
  info,
  onClose,
}: {
  copy: Copy;
  info: AppInfo | null;
  onClose: () => void;
}) {
  const about = copy.about;
  const [copied, setCopied] = useState(false);
  const [suitePick] = useState(pickSuiteApps);
  const [update, setUpdate] = useState<UpdateState>({ state: 'idle' });
  // Default on, like the rest of the suite; the choice is remembered locally.
  const [autoCheck, setAutoCheck] = useState(() => localStorage.getItem(AUTO_CHECK_KEY) !== 'false');
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const version = info?.version || '…';

  useFocusTrap(panelRef);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      // Enter closes too, unless a control keeps it for itself.
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function openExternal(url: string) {
    await window.cyberGoAPI.openExternal(url);
  }

  async function runCheck(force = false) {
    setUpdate({ state: 'checking' });
    try {
      const result = await window.cyberGoAPI.checkUpdates(force);
      if (result.error) setUpdate({ state: 'error' });
      else if (result.available) setUpdate({ state: 'available', latest: result.latest ?? '', url: result.url });
      else setUpdate({ state: 'latest' });
    } catch {
      setUpdate({ state: 'error' });
    }
  }

  // The first open of the window checks by itself, so the section says
  // something instead of waiting for a click.
  useEffect(() => {
    if (autoCheck) void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAutoCheck(next: boolean) {
    setAutoCheck(next);
    localStorage.setItem(AUTO_CHECK_KEY, String(next));
  }

  async function copyDiagnostics() {
    if (!info) return;
    const lines = [
      `CyberGo ${info.version}`,
      `Electron: ${info.electron}`,
      `Chrome: ${info.chrome}`,
      `Node: ${info.node}`,
      `OS: ${platformLabel(info.platform)} ${info.osRelease} (${info.arch})`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard access is optional. */
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal about-modal"
        role="dialog"
        aria-modal="true"
        aria-label={about.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="about-glass" aria-hidden="true" />

        <header className="about-header">
          <div />
          <Tooltip label={copy.close} placement="left">
            <button type="button" className="btn-icon" aria-label={copy.close} onClick={onClose}>
              <X size={16} />
            </button>
          </Tooltip>
        </header>

        <div className="about-body">
          <img className="about-icon" src="icon.png" alt="" aria-hidden="true" draggable={false} />
          <h2 className="about-title">Cyber<span>Go</span></h2>
          <div className="about-version">{about.version.replace('{version}', version)}</div>
          <p className="about-description">{about.description}</p>

          <section className="about-section" aria-label={about.maintenance}>
            <div className="about-section-heading">{about.maintenance}</div>
            {update.state === 'latest' && <div className="about-update-status latest">{about.latestVersion}</div>}
            {update.state === 'available' && (
              <div className="about-update-status available">
                {about.updateAvailable.replace('{version}', update.latest)}
                <button type="button" className="btn btn-primary" onClick={() => void openExternal(update.url || RELEASES_URL)}>
                  <Download size={14} />{about.downloadRelease}
                </button>
              </div>
            )}
            {update.state === 'error' && <div className="about-update-status error">{about.updateError}</div>}
            <div className="about-card">
              {update.state !== 'available' && (
                <button
                  type="button"
                  className="btn about-check"
                  onClick={() => void runCheck(true)}
                  disabled={update.state === 'checking'}
                >
                  <RefreshCw size={14} className={update.state === 'checking' ? 'spin' : ''} />
                  {update.state === 'checking' ? about.checking : about.checkUpdates}
                </button>
              )}
              <button
                type="button"
                className="about-toggle"
                role="switch"
                aria-checked={autoCheck}
                aria-label={about.autoCheck}
                onClick={() => toggleAutoCheck(!autoCheck)}
              >
                <span aria-hidden="true" className="about-toggle-knob" />
                {about.autoCheck}
              </button>
              <p className="about-toggle-hint">{about.autoCheckHint}</p>
            </div>
          </section>

          <section className="about-suite" aria-label={about.suiteTitle}>
            <h3 className="about-section-heading">{about.suiteTitle}</h3>
            <div className="about-suite-icons">
              {suitePick.map((app) => (
                <Tooltip key={app.slug} placement="top" label={<><strong>{app.name}</strong><span className="about-suite-pitch">{about.suitePitches[app.slug]}</span></>}>
                  <button type="button" className="about-suite-app" aria-label={app.name} onClick={() => void openExternal(app.site)}>
                    <img src={`./suite/${app.slug}.png`} alt="" draggable={false} />
                  </button>
                </Tooltip>
              ))}
            </div>
            <button type="button" className="about-suite-more" onClick={() => void openExternal('https://cybergems.org/#apps')}>
              {about.suiteAll} <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>

        <footer className="about-modal-footer">
          <button type="button" className="about-footer-brand" onClick={() => void openExternal(SITE_URL)}>
            {about.footer}
          </button>
          <div className="about-footer-links">
            <Tooltip label={about.websiteTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.websiteTooltip} onClick={() => void openExternal(SITE_URL)}>
                <Gem size={14} />
              </button>
            </Tooltip>
            <Tooltip label={about.wikiTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.wikiTooltip} onClick={() => void openExternal(WIKI_URL)}>
                <BookOpen size={14} />
              </button>
            </Tooltip>
            <Tooltip label={about.githubTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.githubTooltip} onClick={() => void openExternal(REPO_URL)}>
                <Github size={14} />
              </button>
            </Tooltip>
            <Tooltip label={about.issuesTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.issuesTooltip} onClick={() => void openExternal(ISSUES_URL)}>
                <Bug size={14} />
              </button>
            </Tooltip>
            <Tooltip label={copied ? about.diagnosticsCopied : about.copyDiagnostics} placement="top">
              <button
                type="button"
                className="btn-icon"
                aria-label={copied ? about.diagnosticsCopied : about.copyDiagnostics}
                disabled={!info}
                onClick={() => void copyDiagnostics()}
              >
                {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
              </button>
            </Tooltip>
            <Tooltip label={about.releasesTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.releasesTooltip} onClick={() => void openExternal(RELEASES_URL)}>
                <Tag size={14} />
              </button>
            </Tooltip>
            <Tooltip label={about.donateTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.donateTooltip} onClick={() => void openExternal(DONATE_URL)}>
                <Heart size={14} color={DONATE_HEART} fill={DONATE_HEART} stroke="none" />
              </button>
            </Tooltip>
          </div>
        </footer>
      </div>
    </div>
  );
}
