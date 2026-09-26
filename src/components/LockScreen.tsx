import { FormEvent, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import type { AuthMethod } from '@shared/types';
import type { Copy } from '../i18n';
import TitleBar from './TitleBar';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

function digits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

export default function LockScreen({ copy, hint, method }: { copy: Copy; hint: string; method: AuthMethod }) {
  const api = window.cyberGoAPI;
  const [password, setPassword] = useState('');
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
    const result = await api.unlock(password);
    if (result === 'ok') return;
    setError(result === 'wait' ? copy.wait : pin ? copy.wrongPin : copy.wrongPassword);
  }

  async function recover(e: FormEvent) {
    e.preventDefault();
    const result = await api.recover(code, next, nextMethod);
    if (!result.ok) {
      setError(result.error === 'wait' ? copy.wait : result.error === 'pin' ? copy.pinShort : result.error === 'short' ? copy.shortPassword : copy.wrongCode);
      return;
    }
    setRecovery(result.recoveryCode);
    setMode('code');
    setError('');
  }

  useModalKeys(mode !== 'login', {
    esc: () => { setMode('login'); setError(''); },
  });

  return (
    <div className="app">
      <TitleBar title={<><span>Cyber</span>Go</>} />
      <div className="lock-screen">
        <form className="modal lock-card" onSubmit={mode === 'recover' ? recover : unlock}>
          <div className="lock-mark"><Lock size={18} /></div>
          <h2>{copy.appName}</h2>
          {hint && mode === 'login' && <p className="hint">{hint}</p>}
          {mode === 'login' && (
            <label className="field">
              <span>{pin ? copy.authPin : copy.password}</span>
              <input
                ref={loginRef}
                type="password"
                value={password}
                inputMode={pin ? 'numeric' : undefined}
                className={pin ? 'pin-input' : undefined}
                autoComplete="off"
                onChange={(e) => setPassword(pin ? digits(e.target.value) : e.target.value)}
              />
            </label>
          )}
          {mode === 'recover' && (
            <>
              <label className="field"><span>{copy.recoveryCode}</span><input value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></label>
              <div className="seg" style={{ marginBottom: 10 }}>
                <button type="button" className={nextMethod === 'password' ? 'on' : ''} onClick={() => { setNextMethod('password'); }}>{copy.password}</button>
                <button type="button" className={nextMethod === 'pin' ? 'on' : ''} onClick={() => { setNextMethod('pin'); setNext(digits(next)); }}>{copy.authPin}</button>
              </div>
              <label className="field">
                <span>{nextMethod === 'pin' ? copy.newPin : copy.newFromRecovery}</span>
                <input
                  type="password"
                  value={next}
                  inputMode={nextMethod === 'pin' ? 'numeric' : undefined}
                  className={nextMethod === 'pin' ? 'pin-input' : undefined}
                  autoComplete="new-password"
                  onChange={(e) => setNext(nextMethod === 'pin' ? digits(e.target.value) : e.target.value)}
                />
              </label>
            </>
          )}
          {mode === 'code' && (
            <div className="field">
              <span>{copy.recoveryCode}</span>
              <strong>{recovery}</strong>
              <p className="hint">{copy.recoveryHelp}</p>
            </div>
          )}
          <div className="error">{error}</div>
          {mode !== 'code' && <button className="btn btn-primary" type="submit">{mode === 'login' ? copy.unlock : copy.useRecovery}<EnterGlyph /></button>}
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            {mode === 'login' && <button type="button" className="btn" onClick={() => { setMode('recover'); setError(''); }}>{pin ? copy.forgotPin : copy.forgot}</button>}
            {mode !== 'login' && <button type="button" className="btn" onClick={() => { setMode('login'); setError(''); }}>{copy.back}<EscHint /></button>}
          </div>
        </form>
      </div>
    </div>
  );
}
