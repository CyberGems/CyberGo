import { useState, useEffect } from 'react';
import { Task } from '../types';
import { Zap, Calendar, Crosshair } from 'lucide-react';

export default function OverlayView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      const t = await window.cyberGoAPI.getTasks();
      setTasks(t);
    };
    load();
    const interval = setInterval(load, 30000); // Refrescar cada 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pendingTasks = tasks.filter(t => !t.completed && t.dueDate);
  const nextTask = pendingTasks.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: 'rgba(6, 6, 9, 0.88)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-text)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
    }}>
      {/* Header: Hora y Fecha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '26px', fontFamily: 'var(--font-hud)', fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.08em' }}>
            {dateStr}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Zap size={12} color="var(--accent-cyan)" />
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-hud)', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>CyberGo</span>
        </div>
      </div>

      {/* Próxima Tarea */}
      {nextTask ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Próxima Alarma
          </div>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {nextTask.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '10px', fontFamily: 'var(--font-hud)' }}>
            <span style={{
              color: nextTask.priority === 1 ? 'var(--accent-pink)' : nextTask.priority === 2 ? 'var(--accent-sapphire)' : 'var(--text-muted)'
            }}>
              P{nextTask.priority}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>#{nextTask.category}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-amber)' }}>
              <Calendar size={9} />
              {new Date(nextTask.dueDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px' }}>
          <Crosshair size={18} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sin alarmas programadas</span>
        </div>
      )}

      {/* Barra de progreso sutil hasta la próxima tarea */}
      {nextTask && nextTask.dueDate && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            height: '3px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-sapphire))',
              borderRadius: '2px',
              opacity: 0.6
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
