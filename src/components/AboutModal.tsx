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

type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest' }
  | { state: 'available'; latest: string; url: string | null; canInstall: boolean }
  | { state: 'error' };

export default function AboutModal({
  copy,
  info,
  autoCheck,
  onAutoCheckChange,
  onClose,
}: {
  copy: Copy;
  info: AppInfo | null;
  autoCheck: boolean;
  onAutoCheckChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const about = copy.about;
  const [copied, setCopied] = useState(false);
  const [suitePick] = useState(pickSuiteApps);
  const [checkResult, setCheckResult] = useState<UpdateState>({ state: 'idle' });
  const [requestedManually, setRequestedManually] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'ready' | 'installing'>('idle');
  const [progress, setProgress] = useState(0);
  const [actionError, setActionError] = useState<'download' | 'install' | null>(null);
  const checkRequestId = useRef(0);
  const update: UpdateState = autoCheck || requestedManually ? checkResult : { state: 'idle' };
  const updateTag = update.state === 'available' ? update.latest : null;
  const busy = phase === 'downloading' || phase === 'installing';
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const version = info?.version || '…';

  useFocusTrap(panelRef);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    if (!updateTag) return;
    return window.cyberGoAPI.onUpdateProgress((tag, percent) => {
      if (tag === updateTag) setProgress(percent);
    });
  }, [updateTag]);

  function closeAbout() {
    if (!busy) onClose();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy) return;
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
  }, [onClose, busy]);

  async function openExternal(url: string) {
    await window.cyberGoAPI.openExternal(url);
  }

  async function runCheck(force = false) {
    const requestId = ++checkRequestId.current;
    setRequestedManually(force);
    setPhase('idle');
    setActionError(null);
    setCheckResult({ state: 'checking' });
    try {
      const result = await window.cyberGoAPI.checkUpdates(force);
      if (requestId !== checkRequestId.current) return;
      if (result.error) setCheckResult({ state: 'error' });
      else if (result.available && result.latest) {
        setCheckResult({ state: 'available', latest: result.latest, url: result.url, canInstall: result.canInstall === true });
        setPhase(result.downloaded ? 'ready' : 'idle');
      } else setCheckResult({ state: 'latest' });
    } catch {
      if (requestId === checkRequestId.current) setCheckResult({ state: 'error' });
    }
  }

  // The first open of the window checks by itself, so the section says
  // something instead of waiting for a click.
  useEffect(() => {
    if (autoCheck) void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadUpdate(tag: string) {
    setRequestedManually(true);
    setProgress(0);
    setPhase('downloading');
    setActionError(null);
    try {
      if (await window.cyberGoAPI.downloadUpdate(tag)) {
        setPhase('ready');
        return;
      }
    } catch {
      // The main process logs download and verification failures.
    }
    setPhase('idle');
    setActionError('download');
  }

  async function installUpdate(tag: string) {
    setRequestedManually(true);
    setPhase('installing');
    setActionError(null);
    try {
      const result = await window.cyberGoAPI.installUpdate(tag);
      if (result.ok) return;
      setPhase(result.downloaded ? 'ready' : 'idle');
    } catch {
      setPhase('ready');
    }
    setActionError('install');
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
    <div className="backdrop" onMouseDown={closeAbout}>
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
            <button type="button" className="btn-icon" aria-label={copy.close} onClick={closeAbout} disabled={busy}>
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
            {update.state === 'latest' && <div className="about-update-status latest" role="status">{about.latestVersion}</div>}
            {update.state === 'available' && (
              <div className="about-update-status available">
                <span role="status">
                  {phase === 'downloading' ? about.downloadingUpdate
                    : phase === 'ready' ? about.updateReady
                    : phase === 'installing' ? about.installingUpdate
                    : about.updateAvailable.replace('{version}', update.latest)}
                </span>
                {phase === 'downloading' && (
                  <progress className="about-update-progress" max={100} value={progress} aria-label={about.downloadingUpdate} />
                )}
                {phase === 'ready' && (
                  <span className="about-update-hint">{about.updateWillClose}</span>
                )}
                {!busy && (
                  <div className="about-update-actions">
                    {update.canInstall && (phase === 'ready' ? (
                      <button type="button" className="btn btn-primary" onClick={() => void installUpdate(update.latest)}>
                        <RefreshCw size={14} />{about.installUpdate}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => void downloadUpdate(update.latest)}>
                        <Download size={14} />{about.downloadUpdate}
                      </button>
                    ))}
                    <button type="button" className={update.canInstall ? 'btn' : 'btn btn-primary'} onClick={() => void openExternal(update.url || RELEASES_URL)}>
                      {update.canInstall ? about.viewRelease : about.downloadRelease}
                    </button>
                  </div>
                )}
                {actionError && (
                  <div className="about-update-status error" role="alert">
                    {actionError === 'install' ? about.installFailed : about.downloadFailed}
                  </div>
                )}
              </div>
            )}
            {update.state === 'error' && <div className="about-update-status error" role="alert">{about.updateError}</div>}
            <div className="about-card">
              {(update.state !== 'available' || actionError) && (
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
                onClick={() => onAutoCheckChange(!autoCheck)}
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
