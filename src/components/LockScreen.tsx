import { FormEvent, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { AuthMethod } from '@shared/types';
import type { Copy } from '../i18n';
import TitleBar from './TitleBar';
import Tooltip from './Tooltip';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

function digits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

export default function LockScreen({ copy, hint, method, hasPassword }: { copy: Copy; hint: string; method: AuthMethod; hasPassword: boolean }) {
  const api = window.cyberGoAPI;
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState('');
  const [nextMethod, setNextMethod] = useState<AuthMethod>(method);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'login' | 'recover' | 'code'>('login');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState('');
  const pin = method === 'pin';
  const loginRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== 'login') return;
    const focus = () => loginRef.current?.focus();
    focus();
    const timer = window.setTimeout(focus, 50);
    window.addEventListener('focus', focus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', focus);
    };
  }, [mode]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.unlock(password);
      if (result === 'ok') return;
      if (pin) setPassword('');
      setError(result === 'wait' ? copy.wait : pin ? copy.wrongPin : copy.wrongPassword);
    } finally {
      setLoading(false);
    }
  }

  async function recover(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.recover(code, next, nextMethod);
      if (!result.ok) {
        setError(result.error === 'wait' ? copy.wait : result.error === 'pin' ? copy.pinShort : result.error === 'short' ? copy.shortPassword : copy.wrongCode);
        return;
      }
      setRecovery(result.recoveryCode);
      setMode('code');
    } finally {
      setLoading(false);
    }
  }

  useModalKeys(mode !== 'login', {
    esc: () => { setMode('login'); setError(''); },
  });

  return (
    <div className="app login-app">
      <TitleBar
        title={<><span>Cyber</span>Go</>}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      />
      <main className={`lock-screen login-screen ${mode !== 'login' ? 'login-screen-recovery' : ''}`}>
        <div className="login-ambient login-ambient-one" aria-hidden="true" />
        <div className="login-ambient login-ambient-two" aria-hidden="true" />
        <form className={`lock-card login-card ${error ? 'has-error' : ''}`} onSubmit={mode === 'recover' ? recover : unlock}>
          <div className="login-brand">
            <div className="login-icon-shell">
              <img className="login-icon" src="/icon.png" alt="" />
            </div>
            <div className="login-brand-copy">
              <h1>{copy.appName}</h1>
              <span><ShieldCheck size={12} />{copy.loginSecure}</span>
            </div>
          </div>

          <div className="login-divider" />

          {mode === 'login' && (
            <>
              <div className="login-intro">
                <span className="login-eyebrow">{pin ? copy.authPin : copy.password}</span>
                <h2>{copy.loginTitle}</h2>
                <p>{pin ? copy.loginPinSubtitle : copy.loginPasswordSubtitle}</p>
              </div>
              {hint && <p className="login-hint">{hint}</p>}
              {hasPassword ? (
                <div className="login-field">
                  <label className="login-field-label" htmlFor="login-secret">{pin ? copy.authPin : copy.password}</label>
                  <div className="login-input-wrap">
                    <input
                      id="login-secret"
                      ref={loginRef}
                      className={`login-input ${pin ? 'pin-input' : ''}`}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      inputMode={pin ? 'numeric' : undefined}
                      autoComplete="current-password"
                      placeholder={pin ? 'PIN' : copy.password}
                      onChange={(e) => setPassword(pin ? digits(e.target.value) : e.target.value)}
                    />
                    <Tooltip label={showPassword ? copy.hidePassword : copy.showPassword} placement="top">
                      <button
                        type="button"
                        className="login-input-action"
                        tabIndex={-1}
                        aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <p className="login-hint login-hint-panel">{copy.noPassword}</p>
              )}
            </>
          )}

          {mode === 'recover' && (
            <div className="login-intro login-intro-recovery">
              <span className="login-eyebrow">{copy.recoveryCode}</span>
              <h2>{copy.forgot}</h2>
              <p>{copy.recoveryHelp}</p>
            </div>
          )}

          {mode === 'recover' && (
            <div className="login-recovery-fields">
              <label className="login-field">
                <span className="login-field-label">{copy.recoveryCode}</span>
                <input className="login-input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" />
              </label>
              <div className="seg login-method-switch">
                <button type="button" className={nextMethod === 'password' ? 'on' : ''} onClick={() => setNextMethod('password')}>{copy.password}</button>
                <button type="button" className={nextMethod === 'pin' ? 'on' : ''} onClick={() => { setNextMethod('pin'); setNext(digits(next)); }}>{copy.authPin}</button>
              </div>
              <label className="login-field">
                <span className="login-field-label">{nextMethod === 'pin' ? copy.newPin : copy.newFromRecovery}</span>
                <input
                  className={`login-input ${nextMethod === 'pin' ? 'pin-input' : ''}`}
                  type="password"
                  value={next}
                  inputMode={nextMethod === 'pin' ? 'numeric' : undefined}
                  autoComplete="new-password"
                  onChange={(e) => setNext(nextMethod === 'pin' ? digits(e.target.value) : e.target.value)}
                />
              </label>
            </div>
          )}

          {mode === 'code' && (
            <div className="login-recovery-code">
              <span className="login-field-label">{copy.recoveryCode}</span>
              <strong>{recovery}</strong>
              <p>{copy.recoveryHelp}</p>
            </div>
          )}

          {error && <div className="login-error" role="alert">{error}</div>}
          {mode !== 'code' && (
            <button className="btn btn-primary login-submit" type="submit" disabled={loading || (mode === 'recover' && !code.trim())}>
              {loading ? <span>{copy.verifying}</span> : mode === 'login' ? <><Lock size={15} />{copy.unlock}<EnterGlyph /></> : <>{copy.useRecovery}<EnterGlyph /></>}
            </button>
          )}
          <div className="login-actions">
            {mode === 'login' && <button type="button" className="btn login-link" onClick={() => { setMode('recover'); setError(''); }}>{pin ? copy.forgotPin : copy.forgot}</button>}
            {mode !== 'login' && <button type="button" className="btn login-link" onClick={() => { setMode('login'); setError(''); }}>{copy.back}<EscHint /></button>}
          </div>
          <div className="login-footer">{copy.loginAlpha}</div>
        </form>
      </main>
    </div>
  );
}
