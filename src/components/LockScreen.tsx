import { FormEvent, useState } from 'react';
import { Lock } from 'lucide-react';
import type { Copy } from '../i18n';
import TitleBar from './TitleBar';
import { EnterGlyph, EscHint, useModalKeys } from './ModalKeys';

export default function LockScreen({ copy, hint }: { copy: Copy; hint: string }) {
  const api = window.cyberGoAPI;
  const [password, setPassword] = useState('');
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'login' | 'recover' | 'code'>('login');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState('');

  async function unlock(e: FormEvent) {
    e.preventDefault();
    const result = await api.unlock(password);
    if (result === 'ok') return;
    setError(result === 'wait' ? copy.wait : copy.wrongPassword);
  }

  async function recover(e: FormEvent) {
    e.preventDefault();
    const result = await api.recover(code, next);
    if (!result.ok) {
      setError(result.error === 'wait' ? copy.wait : result.error === 'short' ? copy.shortPassword : copy.wrongCode);
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
              <span>{copy.password}</span>
              <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {mode === 'recover' && (
            <>
              <label className="field"><span>{copy.recoveryCode}</span><input value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></label>
              <label className="field"><span>{copy.newFromRecovery}</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
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
            {mode === 'login' && <button type="button" className="btn" onClick={() => { setMode('recover'); setError(''); }}>{copy.forgot}</button>}
            {mode !== 'login' && <button type="button" className="btn" onClick={() => { setMode('login'); setError(''); }}>{copy.back}<EscHint /></button>}
          </div>
        </form>
      </div>
    </div>
  );
}
