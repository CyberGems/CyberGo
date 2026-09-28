import { Minus, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';
import Tooltip from './Tooltip';

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
        <Tooltip label={windowLabels.minimize} placement="bottom">
          <button className="win-btn" onClick={() => api.minimize()} aria-label={windowLabels.minimize}><Minus size={14} /></button>
        </Tooltip>
        <Tooltip label={windowLabels.maximize} placement="bottom">
          <button className="win-btn" onClick={() => api.toggleMaximize()} aria-label={windowLabels.maximize}><Square size={12} /></button>
        </Tooltip>
        <Tooltip label={windowLabels.close} placement="bottom">
          <button className="win-btn close" onClick={() => (onClose ? onClose() : api.close())} aria-label={windowLabels.close}><X size={14} /></button>
        </Tooltip>
      </div>
    </header>
  );
}
