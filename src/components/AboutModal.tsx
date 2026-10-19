import { useEffect, useRef, useState } from 'react';
import { BookOpen, Bug, Check, ClipboardCopy, Cpu, Github, Globe, Tag, X } from 'lucide-react';
import type { AppInfo } from '@shared/types';
import type { Copy } from '../i18n';
import { useFocusTrap } from './Dialog';
import Tooltip from './Tooltip';

const REPO_URL = 'https://github.com/CyberGems/CyberGo';
// The app page of the site is not published yet, so the link goes to the
// home of the suite, which is always there.
const SITE_URL = 'https://cybergems.org';
const WIKI_URL = `${REPO_URL}/wiki`;
const ISSUES_URL = `${REPO_URL}/issues`;
const RELEASES_URL = `${REPO_URL}/releases`;

function platformLabel(platform: string) {
  if (platform === 'win32') return 'Windows';
  if (platform === 'darwin') return 'macOS';
  if (platform === 'linux') return 'Linux';
  return platform;
}

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
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const version = info?.version || '…';

  useFocusTrap(panelRef);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function openExternal(url: string) {
    await window.cyberGoAPI.openExternal(url);
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

          <section className="about-section">
            <div className="about-section-heading">{about.system}</div>
            <div className="about-system-grid">
              <div><span>{about.application}</span><strong>{version}</strong></div>
              <div><span>{about.platform}</span><strong>{info ? `${platformLabel(info.platform)} ${info.osRelease}` : '…'}</strong></div>
              <div><span>{about.engine}</span><strong>{info ? `Electron ${info.electron}` : '…'}</strong></div>
              <div><span>{about.node}</span><strong>{info?.node || '…'}</strong></div>
            </div>
          </section>

          <div className="about-actions">
            <Tooltip label={about.websiteTooltip} placement="top">
              <button type="button" className="btn" onClick={() => void openExternal(SITE_URL)}>
                <Globe size={14} />{about.website}
              </button>
            </Tooltip>
            <Tooltip label={about.githubTooltip} placement="top">
              <button type="button" className="btn" onClick={() => void openExternal(REPO_URL)}>
                <Github size={14} />{about.github}
              </button>
            </Tooltip>
            <Tooltip label={about.wikiTooltip} placement="top">
              <button type="button" className="btn" onClick={() => void openExternal(WIKI_URL)}>
                <BookOpen size={14} />{about.wiki}
              </button>
            </Tooltip>
          </div>

          <div className="about-footer-links">
            <Tooltip label={about.issuesTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.issuesTooltip} onClick={() => void openExternal(ISSUES_URL)}>
                <Bug size={14} />
              </button>
            </Tooltip>
            <Tooltip label={about.releasesTooltip} placement="top">
              <button type="button" className="btn-icon" aria-label={about.releasesTooltip} onClick={() => void openExternal(RELEASES_URL)}>
                <Tag size={14} />
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
            <span className="about-tech-mark" aria-hidden="true"><Cpu size={14} /></span>
          </div>
        </div>

        <footer className="about-modal-footer">
          <button type="button" className="about-footer-brand" onClick={() => void openExternal(SITE_URL)}>
            {about.footer}
          </button>
        </footer>
      </div>
    </div>
  );
}
