import { Minus, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function TitleBar({
  title,
  children,
  onClose,
}: {
  title: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const api = window.cyberGoAPI;
  return (
    <header className="titlebar">
      <div className="drag">
        <div className="brand">{title}</div>
      </div>
      {children}
      <div className="win-controls">
        <button className="win-btn" onClick={() => api.minimize()} aria-label="Minimize"><Minus size={14} /></button>
        <button className="win-btn" onClick={() => api.toggleMaximize()} aria-label="Maximize"><Square size={12} /></button>
        <button className="win-btn close" onClick={() => (onClose ? onClose() : api.close())} aria-label="Close"><X size={14} /></button>
      </div>
    </header>
  );
}
