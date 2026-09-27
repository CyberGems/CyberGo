import { Minus, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function TitleBar({
  title,
  children,
  onClose,
  windowLabels,
}: {
  title: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  windowLabels: {
    minimize: string;
    maximize: string;
    close: string;
  };
}) {
  const api = window.cyberGoAPI;
  return (
    <header className="titlebar">
      <div className="drag">
        <div className="brand">{title}</div>
      </div>
      {children}
      <div className="win-controls">
        <button className="win-btn" onClick={() => api.minimize()} aria-label={windowLabels.minimize} title={windowLabels.minimize}><Minus size={14} /></button>
        <button className="win-btn" onClick={() => api.toggleMaximize()} aria-label={windowLabels.maximize} title={windowLabels.maximize}><Square size={12} /></button>
        <button className="win-btn close" onClick={() => (onClose ? onClose() : api.close())} aria-label={windowLabels.close} title={windowLabels.close}><X size={14} /></button>
      </div>
    </header>
  );
}
