import { FormEvent, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import type { AuthMethod, Lang } from '@shared/types';
import type { Copy } from '../i18n';
import TitleBar from './TitleBar';
import Tooltip from './Tooltip';
import { useFocusTrap } from './Dialog';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';
import WelcomeGreeting from './WelcomeGreeting';

function digits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

/**
 * The lock of the application.
 *
 * The compact form is used by the reminder window, which is too small for the
 * brand and the long texts of the main window.
 */
export default function LockScreen({
  copy,
  hint,
  method,
  hasPassword,
  lang = 'es',
  compact = false,
}: {
  copy: Copy;
  hint: string;
  method: AuthMethod;
  hasPassword: boolean;
  lang?: Lang;
  compact?: boolean;
}) {
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
  const [version, setVersion] = useState('');
  const pin = method === 'pin';
  const loginRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLFormElement>(null);

  useFocusTrap(cardRef);

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

  useEffect(() => {
    if (!api.getAppInfo) return;
    api.getAppInfo()
      .then((info) => setVersion(info?.version ?? ''))
      .catch(() => setVersion(''));
  }, []);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.unlock(password);
      if (result === 'ok') return;
      if (pin) setPassword('');
      setError(result === 'wait' ? copy.wait : pin ? copy.wrongPin : copy.wrongPassword);
    } catch (err) {
      console.error('CyberGo could not unlock', err);
      setError(copy.unlockFailed);
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
    } catch (err) {
      console.error('CyberGo could not recover the access', err);
      setError(copy.unlockFailed);
    } finally {
      setLoading(false);
    }
  }

  useModalKeys(mode !== 'login', {
    esc: () => { setMode('login'); setError(''); },
  });

  const card = (
    <div
      className={`login-card ${compact ? 'is-compact' : ''} ${error ? 'has-error' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={copy.loginTitle}
    >
      <div className="login-logo">
        <div className="login-logo-halo" aria-hidden="true" />
        <img className="login-logo-image" src="/icon.png" alt="" />
      </div>

      <h1 className="login-title">Cyber<span>Go</span></h1>

      {!compact && <WelcomeGreeting copy={copy} lang={lang} />}

      <form
        ref={cardRef}
        className="login-form"
        onSubmit={mode === 'recover' ? recover : unlock}
      >
      {mode === 'login' && (
        <>
          {hasPassword ? (
            <>
              <p className="login-lead">{pin ? copy.loginPinSubtitle : copy.loginPasswordSubtitle}</p>
              {hint && <p className="login-hint">{hint}</p>}
              <div className="login-field">
                <input
                  id="login-secret"
                  ref={loginRef}
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  inputMode={pin ? 'numeric' : undefined}
                  autoComplete="current-password"
                  placeholder={pin ? copy.authPin : copy.password}
                  onChange={(e) => setPassword(pin ? digits(e.target.value) : e.target.value)}
                  style={pin ? undefined : { textAlign: 'left' }}
                  disabled={loading}
                />
                <Tooltip label={showPassword ? copy.hidePassword : copy.showPassword} placement="top">
                  <button
                    type="button"
                    className="login-eye"
                    tabIndex={-1}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Tooltip>
              </div>
            </>
          ) : (
            <p className="login-lead">{copy.noPassword}</p>
          )}
        </>
      )}

      {mode === 'recover' && (
        <>
          <p className="login-lead">{copy.recoveryLead}</p>
          {hint && <p className="login-hint">{hint}</p>}
          <input
            className="login-input is-recovery"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={copy.recoveryCode}
            aria-label={copy.recoveryCode}
            autoFocus
            autoComplete="off"
          />
          <div className="seg login-method-switch">
            <button type="button" className={nextMethod === 'password' ? 'on' : ''} onClick={() => setNextMethod('password')}>{copy.password}</button>
            <button type="button" className={nextMethod === 'pin' ? 'on' : ''} onClick={() => { setNextMethod('pin'); setNext(digits(next)); }}>{copy.authPin}</button>
          </div>
          <input
            className="login-input"
            type="password"
            value={next}
            inputMode={nextMethod === 'pin' ? 'numeric' : undefined}
            autoComplete="new-password"
            placeholder={nextMethod === 'pin' ? copy.newPin : copy.newFromRecovery}
            aria-label={nextMethod === 'pin' ? copy.newPin : copy.newFromRecovery}
            onChange={(e) => setNext(nextMethod === 'pin' ? digits(e.target.value) : e.target.value)}
          />
        </>
      )}

      {mode === 'code' && (
        <div className="login-recovery-code">
          <span className="login-field-label">{copy.recoveryCode}</span>
          <strong>{recovery}</strong>
          <p className="login-hint">{copy.recoveryHelp}</p>
        </div>
      )}

      {error && <div className="login-error" role="alert">{error}</div>}

      {mode !== 'code' && (
        <button className="btn btn-primary login-submit" type="submit" disabled={loading || (mode === 'recover' && !code.trim())}>
          {loading
            ? <span className="login-verifying">{copy.verifying}</span>
            : mode === 'login'
              ? <><Lock size={15} />{copy.unlock}<span className="login-enter" aria-hidden="true"><EnterGlyph /></span></>
              : <>{copy.useRecovery}<span className="login-enter" aria-hidden="true"><EnterGlyph /></span></>}
        </button>
      )}

      <div className="login-actions">
        {mode === 'login' && (
          <button type="button" className="login-link" onClick={() => { setMode('recover'); setError(''); }}>
            <KeyRound size={13} />
            {pin ? copy.forgotPinQuestion : copy.forgotPasswordQuestion}
          </button>
        )}
        {mode !== 'login' && (
          <button type="button" className="login-link" onClick={() => { setMode('login'); setError(''); }}>
            {copy.back}<EscHint />
          </button>
        )}
      </div>

      </form>

      {!compact && version && (
        <div className="login-version">{copy.loginVersion.replace('{version}', version)}</div>
      )}
    </div>
  );

  // The reminder window brings its own title bar, so the compact form does
  // not add a second one.
  if (compact) {
    return (
      <main className="lock-screen login-screen is-compact">
        {card}
      </main>
    );
  }

  return (
    <div className="app login-app">
      <TitleBar
        title={<><span>Cyber</span>Go</>}
        windowLabels={{ minimize: copy.minimize, maximize: copy.maximize, close: copy.closeWindow }}
      />
      <main className="lock-screen login-screen">
        <div className="login-ambient login-ambient-one" aria-hidden="true" />
        <div className="login-ambient login-ambient-two" aria-hidden="true" />
        {card}
      </main>
    </div>
  );
}
