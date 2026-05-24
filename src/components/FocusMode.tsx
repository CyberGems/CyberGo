import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ShieldAlert, Award } from 'lucide-react';
import { Task, AppSettings } from '../types';

interface FocusModeProps {
  task: Task | null;
  settings: AppSettings;
  onClose: () => void;
  onCompleteTask?: (taskId: string) => void;
}

type TimerState = 'idle' | 'running' | 'paused' | 'break';

export default function FocusMode({
  task,
  settings,
  onClose,
  onCompleteTask
}: FocusModeProps) {
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(settings.pomodoroWorkTime * 60);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState<'none' | 'spaceship' | 'digital-rain' | 'quantum-pulse'>('none');
  const [volume, setVolume] = useState(settings.soundVolume);
  const [muted, setMuted] = useState(!settings.soundEnabled);

  const initialTimeRef = useRef(settings.pomodoroWorkTime * 60);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Web Audio API Synthesizer Refs ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Sincronizar timeLeft si cambia la configuración de tiempo
  useEffect(() => {
    const time = (timerState === 'break' ? settings.pomodoroBreakTime : settings.pomodoroWorkTime) * 60;
    initialTimeRef.current = time;
    if (timerState === 'idle') {
      setTimeLeft(time);
    }
  }, [settings.pomodoroWorkTime, settings.pomodoroBreakTime, timerState]);

  // --- Manejo del Temporizador ---
  useEffect(() => {
    if (timerState === 'running') {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleCycleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerState]);

  // Sincronizar volumen del sintetizador
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const vol = muted ? 0 : volume;
      gainNodeRef.current.gain.setValueAtTime(vol * 0.15, audioCtxRef.current.currentTime); // Normalizar volumen
    }
  }, [volume, muted]);

  // Sincronizar tipo de audio
  useEffect(() => {
    if (timerState === 'running') {
      stopSynthesizedAudio();
      startSynthesizedAudio();
    } else {
      stopSynthesizedAudio();
    }
  }, [selectedAudio, timerState]);

  const handleCycleComplete = () => {
    stopSynthesizedAudio();
    playBipSound(); // Alarma de ciclo completo
    
    if (timerState === 'running') {
      setCompletedCycles(prev => prev + 1);
      // Cambiar a descanso
      setTimerState('break');
      const breakTime = settings.pomodoroBreakTime * 60;
      initialTimeRef.current = breakTime;
      setTimeLeft(breakTime);
    } else {
      // Regresar a enfoque
      setTimerState('idle');
      const workTime = settings.pomodoroWorkTime * 60;
      initialTimeRef.current = workTime;
      setTimeLeft(workTime);
    }
  };

  const handleStartPause = () => {
    if (timerState === 'idle' || timerState === 'paused' || timerState === 'break') {
      setTimerState(timerState === 'break' ? 'running' : 'running');
    } else if (timerState === 'running') {
      setTimerState('paused');
    }
  };

  const handleReset = () => {
    stopSynthesizedAudio();
    setTimerState('idle');
    const workTime = settings.pomodoroWorkTime * 60;
    initialTimeRef.current = workTime;
    setTimeLeft(workTime);
  };

  const handleToggleMute = () => {
    setMuted(prev => !prev);
  };

  // ============================================================================
  // SINTETIZADOR DE AUDIO WEB (WEB AUDIO API)
  // ============================================================================

  const playBipSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // La natural de la campana
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.8);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.error(e);
    }
  };

  const startSynthesizedAudio = () => {
    if (selectedAudio === 'none') return;
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      gainNodeRef.current = ctx.createGain();
      const baseGain = muted ? 0 : volume;
      gainNodeRef.current.gain.setValueAtTime(baseGain * 0.15, ctx.currentTime);

      if (selectedAudio === 'spaceship') {
        // --- Sintetizar Nave Aeroespacial (Deep brown noise + low frequency oscillation) ---
        // Generar un búfer de ruido marrón
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Filtro acumulativo para transformar ruido blanco a marrón
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5; // Amplificar
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Crear filtro pasabajos profundo
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(140, ctx.currentTime);
        lowpass.Q.setValueAtTime(1.5, ctx.currentTime);

        // LFO para crear el "latido/viento" de la nave
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // LFO muy lento 0.2Hz
        lfoGain.gain.setValueAtTime(30, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(lowpass.frequency); // Modular frecuencia de corte del filtro
        lfo.start();

        whiteNoise.connect(lowpass);
        lowpass.connect(gainNodeRef.current);
        
        whiteNoise.start();
        audioSourceRef.current = whiteNoise;

      } else if (selectedAudio === 'digital-rain') {
        // --- Sintetizar Lluvia de Código (Ruido rosa con oscilaciones de banda estrecha) ---
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.11; // Escalar
          b6 = white * 0.115926;
        }

        const pinkNoise = ctx.createBufferSource();
        pinkNoise.buffer = noiseBuffer;
        pinkNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);
        filter.Q.setValueAtTime(0.7, ctx.currentTime);

        pinkNoise.connect(filter);
        filter.connect(gainNodeRef.current);
        
        pinkNoise.start();
        audioSourceRef.current = pinkNoise;

      } else if (selectedAudio === 'quantum-pulse') {
        // --- Sintetizar Pulso Cuántico (Osciladores entrelazados con modulación de frecuencia) ---
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();

        carrier.type = 'triangle';
        carrier.frequency.setValueAtTime(95, ctx.currentTime); // Hz muy bajo y cálido

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(4, ctx.currentTime); // 4Hz oscilador de frecuencia
        modGain.gain.setValueAtTime(15, ctx.currentTime);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency); // FM Modulation!

        // Filtro pasabajos para redondear el pulso cuántico
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, ctx.currentTime);

        carrier.connect(filter);
        filter.connect(gainNodeRef.current);

        modulator.start();
        carrier.start();
        audioSourceRef.current = carrier;
      }

      gainNodeRef.current.connect(ctx.destination);
    } catch (err) {
      console.error('Failed to create synthesized background audio:', err);
    }
  };

  const stopSynthesizedAudio = () => {
    try {
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch (e) {
      // Ignorar errores al desconectar
    }
  };

  useEffect(() => {
    return () => {
      stopSynthesizedAudio();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  // --- Formatear tiempo (MM:SS) ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // SVG Circular Progress
  const strokeRadius = 140;
  const strokeCircumference = 2 * Math.PI * strokeRadius;
  const strokeDashoffset = strokeCircumference - (timeLeft / initialTimeRef.current) * strokeCircumference;

  // Determinar color de tema para la pantalla de enfoque
  const isBreak = timerState === 'break';
  const strokeColor = isBreak ? 'var(--accent-emerald)' : 'var(--accent-cyan)';
  const strokeGlow = isBreak ? 'var(--accent-emerald-glow)' : 'var(--accent-cyan-glow)';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#040406',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* HUD Background Mesh/Grid lines */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Header controls */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        zIndex: 2,
        background: 'rgba(4, 4, 6, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '11px',
            color: strokeColor,
            fontWeight: 800,
            fontFamily: 'var(--font-hud)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            textShadow: `0 0 10px ${strokeGlow}`
          }}>
            {isBreak ? 'MÓDULO DESCANSO' : 'MÓDULO ENFOQUE CUÁNTICO'}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="hud-btn"
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          SALIR DE ENFOQUE
        </button>
      </div>

      {/* Main Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        zIndex: 1,
        position: 'relative',
        height: 'calc(100vh - 70px)'
      }}>
        
        {/* Left Panel - Task Meta Info */}
        <div style={{
          width: '380px',
          borderRight: '1px solid rgba(255, 255, 255, 0.03)',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'rgba(6, 6, 9, 0.6)'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Tarea Activa de Enfoque
            </div>
            
            {task ? (
              <div style={{ marginTop: '16px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  {task.title}
                </h1>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                  <span className={`priority-dot priority-dot-${task.priority}`} />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    PRIORIDAD {task.priority}  |  {task.category}
                  </span>
                </div>
                
                {task.notes && (
                  <p style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {task.notes}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ 
                marginTop: '32px',
                padding: '20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px dashed var(--accent-gray)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                textAlign: 'center'
              }}>
                <ShieldAlert size={28} style={{ color: 'var(--accent-amber)', margin: '0 auto 12px' }} />
                Enfoque libre activo.<br/>No se ha seleccionado ninguna tarea.
              </div>
            )}
          </div>

          {/* Stats area */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.015)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Award size={18} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-hud)', color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Logros de la Sesión
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ciclos Completados</span>
              <span style={{ fontSize: '20px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--accent-amber)' }}>
                {completedCycles}
              </span>
            </div>
            {task && onCompleteTask && (
              <button
                onClick={() => {
                  playBipSound();
                  onCompleteTask(task.id);
                  onClose();
                }}
                className="hud-btn hud-btn-active"
                style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
              >
                ✓ MARCAR COMPLETADA Y SALIR
              </button>
            )}
          </div>
        </div>

        {/* Center/Right Panel - Giant Clock and Audio Control */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '40px'
        }}>
          {/* Clock visualization */}
          <div style={{ position: 'relative', width: '320px', height: '320px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
            
            {/* SVG Circular Progress Bar */}
            <svg style={{ transform: 'rotate(-90deg)', width: '320px', height: '320px', position: 'absolute', top: 0, left: 0 }}>
              <circle
                cx="160"
                cy="160"
                r={strokeRadius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.02)"
                strokeWidth="6"
              />
              <motion.circle
                cx="160"
                cy="160"
                r={strokeRadius}
                fill="transparent"
                stroke={strokeColor}
                strokeWidth="6"
                strokeDasharray={strokeCircumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5, ease: 'linear' }}
                style={{
                  filter: `drop-shadow(0 0 10px ${strokeGlow})`
                }}
              />
            </svg>

            {/* Inner HUD decorative circles */}
            <div style={{
              position: 'absolute',
              top: '30px',
              left: '30px',
              width: '260px',
              height: '260px',
              border: '1px dashed rgba(255, 255, 255, 0.03)',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', letterSpacing: '0.1em' }}>
                {timerState.toUpperCase()}
              </span>
              
              <h1 style={{
                fontSize: '56px',
                fontWeight: 700,
                fontFamily: 'var(--font-hud)',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
                marginTop: '4px',
                textShadow: timerState === 'running' ? `0 0 20px ${strokeGlow}` : 'none'
              }}>
                {formatTime(timeLeft)}
              </h1>
              
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-hud)', letterSpacing: '0.05em', marginTop: '6px' }}>
                DE {(timerState === 'break' ? settings.pomodoroBreakTime : settings.pomodoroWorkTime)} MINUTOS
              </span>
            </div>
          </div>

          {/* Play/Pause/Reset Controls */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <button
              onClick={handleReset}
              className="hud-btn"
              title="Reiniciar temporizador"
              style={{ padding: '12px 18px', borderRadius: '50px' }}
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={handleStartPause}
              className="hud-btn hud-btn-active"
              style={{
                padding: '14px 28px',
                borderRadius: '50px',
                borderColor: strokeColor,
                boxShadow: timerState === 'running' ? `0 0 15px ${strokeGlow}` : 'none',
                background: timerState === 'running' ? strokeGlow : 'var(--theme-color-glow)'
              }}
            >
              {timerState === 'running' ? (
                <><Pause size={16} fill="currentColor" /> PAUSAR ENFOQUE</>
              ) : (
                <><Play size={16} fill="currentColor" /> INICIAR ENFOQUE</>
              )}
            </button>
          </div>

          {/* Synth Audio Ambient Selector */}
          <div className="glass-panel" style={{
            padding: '16px 24px',
            width: '420px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'rgba(10, 10, 15, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-hud)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  AUDIO AMBIENTAL SINTETIZADO
                </span>
              </div>
              <button 
                onClick={handleToggleMute}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            </div>

            {/* Audio selector options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => setSelectedAudio('none')}
                className={`hud-btn ${selectedAudio === 'none' ? 'hud-btn-active' : ''}`}
                style={{ fontSize: '10px', padding: '6px' }}
              >
                Sin Sonido
              </button>
              <button
                onClick={() => setSelectedAudio('spaceship')}
                className={`hud-btn ${selectedAudio === 'spaceship' ? 'hud-btn-active' : ''}`}
                style={{ fontSize: '10px', padding: '6px' }}
              >
                Humedad Espacial
              </button>
              <button
                onClick={() => setSelectedAudio('digital-rain')}
                className={`hud-btn ${selectedAudio === 'digital-rain' ? 'hud-btn-active' : ''}`}
                style={{ fontSize: '10px', padding: '6px' }}
              >
                Lluvia de Código
              </button>
              <button
                onClick={() => setSelectedAudio('quantum-pulse')}
                className={`hud-btn ${selectedAudio === 'quantum-pulse' ? 'hud-btn-active' : ''}`}
                style={{ fontSize: '10px', padding: '6px' }}
              >
                Pulso Cuántico
              </button>
            </div>

            {/* Volume slider */}
            {selectedAudio !== 'none' && !muted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <Volume2 size={12} color="var(--text-secondary)" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: strokeColor,
                    height: '3px',
                    background: 'var(--accent-gray)',
                    borderRadius: '2px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
