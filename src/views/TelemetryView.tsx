import { useMemo } from 'react';
import { Task } from '../types';
import { BarChart3, TrendingUp, Target, Zap, Award, AlertTriangle } from 'lucide-react';

interface TelemetryViewProps {
  tasks: Task[];
}

export default function TelemetryView({ tasks }: TelemetryViewProps) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const analytics = useMemo(() => {
    const completed = tasks.filter(t => t.completed && t.completedAt);
    const overdue = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now);

    // --- Tareas por día (últimos 7 días) ---
    const last7Days: { date: string; label: string; count: number; score: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = completed.filter(t => t.completedAt && t.completedAt.startsWith(dateStr));
      const score = dayTasks.reduce((acc, t) => acc + (t.priority === 1 ? 4 : t.priority === 2 ? 2 : t.priority === 3 ? 1 : 0.5), 0);
      last7Days.push({
        date: dateStr,
        label: d.toLocaleDateString([], { weekday: 'short' }),
        count: dayTasks.length,
        score
      });
    }

    // --- Heatmap últimos 30 días ---
    const last30Days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = completed.filter(t => t.completedAt && t.completedAt.startsWith(dateStr)).length;
      last30Days.push({ date: dateStr, count });
    }

    // --- Score Total (todo el tiempo) ---
    const totalScore = completed.reduce((acc, t) => acc + (t.priority === 1 ? 4 : t.priority === 2 ? 2 : t.priority === 3 ? 1 : 0.5), 0)
      - (overdue.length * 3);

    // --- Ratio ---
    const totalCompleted = completed.length;
    const totalOverdue = overdue.length;

    // --- Distribución por prioridad ---
    const priorityDist = [1, 2, 3, 4].map(p => ({
      priority: p,
      count: completed.filter(t => t.priority === p).length
    }));

    return { last7Days, last30Days, totalScore, totalCompleted, totalOverdue, priorityDist };
  }, [tasks]);

  const maxCount7 = Math.max(...analytics.last7Days.map(d => d.count), 1);
  const maxCount30 = Math.max(...analytics.last30Days.map(d => d.count), 1);

  const getHeatColor = (count: number, max: number) => {
    if (count === 0) return 'rgba(255,255,255,0.02)';
    const intensity = Math.max(0.15, count / max);
    return `rgba(0, 255, 135, ${intensity})`;
  };

  return (
    <div className="view-container" style={{ overflowY: 'auto' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-hud)', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          TELEMETRÍA DE PRODUCTIVIDAD
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Análisis de velocidad, patrones y rendimiento de tu flujo de trabajo.
        </p>
      </div>

      {/* Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-amber)' }}>
            <Award size={16} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Productivity Score</span>
          </div>
          <div style={{ fontSize: '28px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--text-primary)' }}>
            {Math.round(analytics.totalScore).toLocaleString()}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
            <TrendingUp size={16} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completadas</span>
          </div>
          <div style={{ fontSize: '28px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--text-primary)' }}>
            {analytics.totalCompleted}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-pink)' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vencidas</span>
          </div>
          <div style={{ fontSize: '28px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--text-primary)' }}>
            {analytics.totalOverdue}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
            <Target size={16} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ratio C/V</span>
          </div>
          <div style={{ fontSize: '28px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--text-primary)' }}>
            {analytics.totalOverdue > 0 ? (analytics.totalCompleted / analytics.totalOverdue).toFixed(1) : analytics.totalCompleted > 0 ? '∞' : '0'}
          </div>
        </div>
      </div>

      {/* Gráfico de Barras Últimos 7 Días */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={16} color="var(--accent-sapphire)" />
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tareas Completadas — Últimos 7 Días
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px', padding: '0 8px' }}>
          {analytics.last7Days.map((day) => (
            <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)' }}>
                {day.count}
              </div>
              <div style={{
                width: '100%',
                height: `${Math.max((day.count / maxCount7) * 100, 4)}%`,
                minHeight: '4px',
                background: day.date === todayStr ? 'var(--accent-cyan)' : 'var(--accent-sapphire)',
                borderRadius: '4px 4px 0 0',
                opacity: day.count === 0 ? 0.2 : 0.8,
                transition: 'height 0.4s ease'
              }} />
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase' }}>
                {day.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Últimos 30 Días */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Zap size={16} color="var(--accent-emerald)" />
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Heatmap de Actividad — Últimos 30 Días
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '6px' }}>
          {analytics.last30Days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} tareas`}
              style={{
                aspectRatio: '1',
                borderRadius: '4px',
                background: getHeatColor(day.count, maxCount30),
                border: day.date === todayStr ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map((i) => (
            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: `rgba(0,255,135,${Math.max(0.15, i)})` }} />
          ))}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Más</span>
        </div>
      </div>

      {/* Distribución por Prioridad */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
          Distribución por Prioridad (Completadas)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analytics.priorityDist.map(p => {
            const total = analytics.totalCompleted || 1;
            const pct = (p.count / total) * 100;
            const color = p.priority === 1 ? 'var(--accent-pink)' : p.priority === 2 ? 'var(--accent-sapphire)' : p.priority === 3 ? 'var(--accent-amber)' : 'var(--text-muted)';
            return (
              <div key={p.priority} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '60px', fontSize: '11px', fontFamily: 'var(--font-hud)', color }}>
                  P{p.priority}
                </span>
                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <span style={{ width: '40px', textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)' }}>
                  {p.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
