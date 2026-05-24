import { Minus, Square, X, Terminal } from 'lucide-react';

interface TitleBarProps {
  title?: string;
}

export default function TitleBar({ title = 'CYBERGO' }: TitleBarProps) {
  const handleMinimize = () => {
    window.cyberGoAPI.windowMinimize();
  };

  const handleMaximize = () => {
    window.cyberGoAPI.windowMaximizeToggle();
  };

  const handleClose = () => {
    window.cyberGoAPI.windowClose();
  };

  const handleDevTools = () => {
    window.cyberGoAPI.openDevTools();
  };

  return (
    <header className="titlebar">
      <div className="titlebar-logo-area">
        <span>⬢</span> {title}
      </div>
      
      <div className="titlebar-controls">
        {/* Developer Console Toggle for Power Users */}
        <button 
          onClick={handleDevTools} 
          className="titlebar-btn" 
          title="Terminal de Desarrollador (DevTools)"
        >
          <Terminal size={13} />
        </button>
        
        <button 
          onClick={handleMinimize} 
          className="titlebar-btn" 
          title="Minimizar"
        >
          <Minus size={14} />
        </button>
        
        <button 
          onClick={handleMaximize} 
          className="titlebar-btn" 
          title="Maximizar / Restaurar"
        >
          <Square size={12} />
        </button>
        
        <button 
          onClick={handleClose} 
          className="titlebar-btn titlebar-btn-close" 
          title="Cerrar"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
