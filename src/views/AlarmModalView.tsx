import { useState, useEffect } from 'react';
import { Task } from '../types';
import { ShieldAlert, Check, Clock, Zap } from 'lucide-react';

export default function AlarmModalView() {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/taskId=([^&]+)/);
    const taskId = match ? match[1] : null;

    if (taskId) {
      window.cyberGoAPI.getTasks().then(tasks => {
        const found = tasks.find(t => t.id === taskId);
        setTask(found || null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleComplete = async () => {
    if (!task) return;
    await window.cyberGoAPI.saveTask({
      ...task,
      completed: true,
      completedAt: new Date().toISOString()
    });
    window.close();
  };

  const handleSnooze = async (minutes: number) => {
    if (!task || !task.dueDate) return;
    const current = new Date();
    current.setMinutes(current.getMinutes() + minutes);
    await window.cyberGoAPI.saveTask({
      ...task,
      dueDate: current.toISOString(),
      reminderTriggered: false,
      preAlarmSent: false
    });
    window.close();
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#08080c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-hud)',
        fontSize: '13px',
        color: 'var(--accent-pink)'
      }}>
        <Zap size={20} style={{ marginRight: '8px' }} /> INICIANDO MODAL DE ALARMA...
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#08080c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-hud)',
        fontSize: '13px',
        color: 'var(--text-muted)'
      }}>
        TAREA NO ENCONTRADA
      </div>
    );
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: '#08080c',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px',
      fontFamily: 'var(--font-text)',
      color: 'var(--text-primary)',
      border: '2px solid var(--accent-pink)',
      boxSizing: 'border-box'
    }}>
      {/* Header crítico */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <ShieldAlert size={28} color="var(--accent-pink)" style={{ filter: 'drop-shadow(0 0 8px var(--accent-pink-glow))' }} />
        <div>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-hud)',
            color: 'var(--accent-pink)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 800
          }}>
            ALARMA CRÍTICA P1 — REQUIERE ACCIÓN
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isOverdue ? 'VENCIDA' : 'VENCE PRONTO'} | Categoría: #{task.category}
          </div>
        </div>
      </div>

      {/* Título de la tarea */}
      <div style={{
        fontSize: '22px',
        fontWeight: 600,
        lineHeight: 1.3,
        marginBottom: '16px',
        color: 'var(--text-primary)'
      }}>
        {task.title}
      </div>

      {task.notes && (
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: '20px',
          padding: '12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '6px',
          border: '1px solid var(--glass-border)'
        }}>
          {task.notes}
        </div>
      )}

      {/* Acciones forzadas */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={handleComplete}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(0,255,135,0.08)',
            border: '1px solid var(--accent-emerald)',
            borderRadius: '8px',
            color: 'var(--accent-emerald)',
            fontFamily: 'var(--font-hud)',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: '0 0 15px rgba(0,255,135,0.1)'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,135,0.15)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(0,255,135,0.25)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,135,0.08)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 15px rgba(0,255,135,0.1)';
          }}
        >
          <Check size={18} /> MARCAR COMO COMPLETADA
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleSnooze(15)}
            style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-hud)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Clock size={12} /> POSPONER 15M
          </button>
          <button
            onClick={() => handleSnooze(60)}
            style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-hud)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Clock size={12} /> POSPONER 1H
          </button>
        </div>
      </div>
    </div>
  );
}
