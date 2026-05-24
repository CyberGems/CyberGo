import { Clock, Play } from 'lucide-react';
import { Task } from '../types';

interface TimelineViewProps {
  tasks: Task[];
  onStartFocus: (task: Task) => void;
}

export default function TimelineView({ tasks, onStartFocus }: TimelineViewProps) {
  const pendingTasksWithDate = tasks.filter(t => !t.completed && t.dueDate);

  // Agrupar tareas cronológicamente
  const now = new Date();
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  const tomorrowEnd = new Date();
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const overdue: Task[] = [];
  const today: Task[] = [];
  const tomorrow: Task[] = [];
  const thisWeek: Task[] = [];
  const future: Task[] = [];

  pendingTasksWithDate.forEach(task => {
    const due = new Date(task.dueDate!);
    if (due < now) {
      overdue.push(task);
    } else if (due <= todayEnd) {
      today.push(task);
    } else if (due <= tomorrowEnd) {
      tomorrow.push(task);
    } else if (due <= weekEnd) {
      thisWeek.push(task);
    } else {
      future.push(task);
    }
  });

  // Ordenar cada grupo por fecha
  const sortByDate = (list: Task[]) => {
    return [...list].sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  };

  const timeGroups = [
    { title: "Vencidos", list: sortByDate(overdue), color: 'var(--accent-pink)', isOverdue: true },
    { title: "Hoy", list: sortByDate(today), color: 'var(--accent-cyan)' },
    { title: "Mañana", list: sortByDate(tomorrow), color: 'var(--accent-sapphire)' },
    { title: "Esta Semana", list: sortByDate(thisWeek), color: 'var(--accent-amber)' },
    { title: "Próximamente", list: sortByDate(future), color: 'var(--text-muted)' }
  ];

  return (
    <div className="view-container" style={{ overflowY: 'auto' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-hud)', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          CRONOGRAMA DE ACTIVIDADES
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Visualiza tu flujo cronológico de alarmas y vencimientos en un eje lineal integrado.
        </p>
      </div>

      {/* Timeline Eje */}
      <div style={{
        position: 'relative',
        paddingLeft: '32px',
        marginTop: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px'
      }}>
        {/* Eje de Línea Central */}
        <div style={{
          position: 'absolute',
          left: '7px',
          top: '12px',
          bottom: '12px',
          width: '1px',
          background: 'linear-gradient(180deg, var(--accent-pink), var(--accent-cyan), var(--accent-amber), rgba(255,255,255,0.01))'
        }} />

        {timeGroups.map((group, groupIdx) => {
          if (group.list.length === 0) return null;

          return (
            <div key={groupIdx} style={{ position: 'relative' }}>
              {/* Nodo del Grupo en la Línea */}
              <div style={{
                position: 'absolute',
                left: '-32px',
                top: '4px',
                width: '15px',
                height: '15px',
                borderRadius: '50%',
                background: '#08080c',
                border: `3px solid ${group.color}`,
                boxShadow: `0 0 10px ${group.color}`,
                zIndex: 2
              }} />

              {/* Título de Sección de Tiempo */}
              <h2 style={{
                fontSize: '12px',
                fontFamily: 'var(--font-hud)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: group.color,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {group.title}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  ({group.list.length})
                </span>
              </h2>

              {/* Tarjetas del Grupo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.list.map(task => (
                  <div
                    key={task.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderColor: group.isOverdue ? 'rgba(255,0,127,0.2)' : 'var(--glass-border)',
                      padding: '10px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <Clock size={14} color={group.color} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {task.title}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '10px',
                          fontFamily: 'var(--font-hud)',
                          textTransform: 'uppercase',
                          color: 'var(--text-secondary)',
                          marginTop: '4px'
                        }}>
                          <span className={`priority-dot priority-dot-${task.priority}`} />
                          <span>P{task.priority}  |  #{task.category}</span>
                          <span style={{ color: group.isOverdue ? 'var(--accent-pink)' : 'var(--accent-cyan)' }}>
                            {new Date(task.dueDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {group.isOverdue && " — VENCIDO"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartFocus(task)}
                      className="hud-btn"
                      style={{ padding: '4px 8px', fontSize: '9px', color: 'var(--accent-cyan)' }}
                    >
                      <Play size={10} /> ENFOQUE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {pendingTasksWithDate.length === 0 && (
          <div style={{
            padding: '60px 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px'
          }}>
            No hay recordatorios programados en tu cronograma lineal.
          </div>
        )}
      </div>

    </div>
  );
}
