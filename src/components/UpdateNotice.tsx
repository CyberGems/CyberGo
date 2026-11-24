import { useEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Copy } from '../i18n';
import { releaseNotesPeek } from '../lib/releaseNotes';
import type { UpdateOffer } from '../lib/useUpdateNotice';
import { useFocusTrap } from './Dialog';

export default function UpdateNotice({
  offer, copy, language, installed, aboveAbout, focusOnOpen, onClose, onGitHub, onSkip, onDownload, onCancel, onInstall,
}: {
  offer: UpdateOffer;
  copy: Copy;
  language: 'en' | 'es';
  installed?: string;
  aboveAbout: boolean;
  focusOnOpen: boolean;
  onClose: () => void;
  onGitHub: () => void;
  onSkip: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onInstall: () => void;
}) {
  const { release, phase, percent, cancelling, error } = offer;
  const ui = copy.updates;
  const panel = useRef<HTMLElement>(null);
  useFocusTrap(panel, aboveAbout, 'container');
  const notes = releaseNotesPeek(release.releaseNotes, language);
  const published = release.publishedAt ? new Date(release.publishedAt) : null;
  const downloading = phase === 'downloading';
  const installing = phase === 'installing';
  const title = phase === 'available' ? ui.available : downloading
    ? (cancelling ? ui.cancelling : ui.downloading)
    : (installing ? ui.installing : ui.ready);

  useEffect(() => {
    if (focusOnOpen && !aboveAbout) panel.current?.focus();
  }, [aboveAbout, focusOnOpen]);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || (!aboveAbout && !panel.current?.contains(event.target as Node))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!installing) onClose();
    }
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [aboveAbout, installing, onClose]);

  return (
    <section className="update-notice" ref={panel} tabIndex={-1} role="dialog" aria-modal={aboveAbout || undefined} aria-labelledby="update-title">
      <header className="update-notice-header">
        <img src="icon.png" alt="" width="36" height="36" />
        <div>
          <h2 id="update-title" aria-live="polite">{title}</h2>
          <div className="update-notice-version">
            {installed && <><span>v{installed.replace(/^v/i, '')}</span><ArrowRight size={13} aria-hidden="true" /></>}
            <strong>v{release.latest.replace(/^v/i, '')}</strong>
            {published && Number.isFinite(published.getTime()) && (
              <time dateTime={release.publishedAt}>{published.toLocaleDateString(language)}</time>
            )}
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} disabled={installing}
          aria-label={downloading ? ui.background : copy.close}><X size={16} /></button>
      </header>
      <div className="update-notice-body">
        <div className="update-notice-notes">
          <h3>{ui.notes}</h3>
          <div className="update-notice-peek" tabIndex={notes.length ? 0 : undefined}>
            {notes.length ? <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p>{ui.noNotes}</p>}
          </div>
        </div>
        {downloading && (
          <div className="update-notice-progress">
            <div><span>{ui.progress}</span><span>{percent}%</span></div>
            <progress max={100} value={percent || undefined} aria-label={ui.progress} />
          </div>
        )}
        {phase === 'available' && !release.canInstall && <p className="update-notice-message">{ui.noPackage}</p>}
        {error && <p className="update-notice-message update-notice-error" role="alert">{ui.errors[error]}</p>}
      </div>
      <footer className="update-notice-actions">
        {phase === 'available' && <>
          <button type="button" className="btn" onClick={onGitHub}>{ui.github}</button>
          <button type="button" className="btn" onClick={onSkip}>{ui.skip}</button>
          <button type="button" className="btn" onClick={onClose}>{ui.later}</button>
          <button type="button" className="btn btn-primary" disabled={!release.canInstall} onClick={onDownload}>{ui.updateNow}</button>
        </>}
        {downloading && <>
          <button type="button" className="btn" onClick={onClose}>{ui.background}</button>
          <button type="button" className="btn" disabled={cancelling} onClick={onCancel}>{ui.cancel}</button>
        </>}
        {(phase === 'ready' || installing) && <>
          <button type="button" className="btn" disabled={installing} onClick={onClose}>{ui.later}</button>
          <button type="button" className="btn btn-primary" disabled={installing} onClick={onInstall}>{ui.restart}</button>
        </>}
      </footer>
    </section>
  );
}
