import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import App from './App';
import { applyTheme } from './themes';
import { copyOf, type Copy } from './i18n';
import './index.css';

const saved = localStorage.getItem('cybergo-theme');
if (saved) applyTheme(saved);

function detectCopy(): Copy {
  const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  return copyOf(lang);
}

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Catches render time failures so the window never stays blank.
 * The fallback screen explains what happened and offers a reload.
 */
class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CyberGo crashed while rendering', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const copy = detectCopy();
    return (
      <div className="fatal">
        <div className="fatal-card">
          <h1>{copy.fatalTitle}</h1>
          <p>{copy.fatalBody}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {copy.reload}
          </button>
        </div>
      </div>
    );
  }
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('CyberGo unhandled promise rejection', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
