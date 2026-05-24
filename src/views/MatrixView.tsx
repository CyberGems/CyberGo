import { motion } from 'motion/react';
import { ShieldAlert, Star, Activity, Trash2, Clock } from 'lucide-react';
import { Task } from '../types';

interface MatrixViewProps {
  tasks: Task[];
  onSaveTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
}

export default function MatrixView({
  tasks,
  onSaveTask,
  onDeleteTask,
  onStartFocus
}: MatrixViewProps) {
  const pendingTasks = tasks.filter(t => !t.completed);

  // Agrupar tareas en los 4 cuadrantes correspondientes a las prioridades 1 a 4
  const q1 = pendingTasks.filter(t => t.priority === 1); // Urgente e Importante
  const q2 = pendingTasks.filter(t => t.priority === 2); // Importante pero No Urgente
  const q3 = pendingTasks.filter(t => t.priority === 3); // Urgente pero No Importante
  const q4 = pendingTasks.filter(t => t.priority === 4); // Ni Urgente ni Importante

  const handleUpdatePriority = (task: Task, newPriority: 1 | 2 | 3 | 4) => {
    onSaveTask({
      ...task,
      priority: newPriority
    });
  };

  const isTaskBlocked = (task: Task): boolean => {
    if (!task.blockedBy || task.blockedBy.length === 0) return false;
    return task.blockedBy.some(blockerId => {
      const blocker = tasks.find(t => t.id === blockerId);
      return blocker && !blocker.completed;
    });
  };

  const renderQuadrant = (
    title: string,
    tasksList: Task[],
    priorityValue: 1 | 2 | 3 | 4,
    themeColor: string,
    icon: React.ReactNode,
    actionText: string
  ) => {
    return (
      <div 
        className="glass-panel" 
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderColor: `rgba(${themeColor}, 0.2)`,
          background: `rgba(${themeColor}, 0.015)`
        }}
      >
        {/* Quadrant Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `rgba(${themeColor}, 0.04)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: `rgb(${themeColor})`, display: 'flex', alignItems: 'center' }}>
              {icon}
            </span>
            <div>
              <div style={{
                fontFamily: 'var(--font-hud)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: `rgb(${themeColor})`,
                textShadow: `0 0 10px rgba(${themeColor}, 0.3)`
              }}>
                {title}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                Acción recomendada: {actionText}
              </div>
            </div>
          </div>
          <span style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '13px',
            fontWeight: 800,
            color: `rgb(${themeColor})`
          }}>
            {tasksList.length}
          </span>
        </div>

        {/* Quadrant Tasks List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {tasksList.length > 0 ? (
            tasksList.map(task => {
              const blocked = isTaskBlocked(task);
              return (
              <motion.div
                key={task.id}
                layout
                className="glass-card"
                style={{
                  padding: '8px 10px',
                  background: blocked ? 'rgba(51,65,85,0.04)' : 'rgba(255,255,255,0.015)',
                  fontSize: '13px',
                  opacity: blocked ? 0.5 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ fontWeight: 500, color: blocked ? 'var(--text-muted)' : 'var(--text-primary)', wordBreak: 'break-word', flex: 1 }}>
                    {blocked && '🔒 '}{task.title}
                  </div>
                  
                  {/* Focus Action */}
                  {!blocked && (
                  <button
                    onClick={() => onStartFocus(task)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.7
                    }}
                    title="Iniciar Enfoque Pomodoro"
                  >
                    <Clock size={11} />
                  </button>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                  paddingTop: '6px'
                }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase' }}>
                    #{task.category}
                  </span>
                  
                  {/* Controles de Re-priorización */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Mover:</span>
                    <select
                      value={priorityValue}
                      onChange={(e) => handleUpdatePriority(task, parseInt(e.target.value, 10) as 1 | 2 | 3 | 4)}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-secondary)',
                        fontSize: '9px',
                        fontFamily: 'var(--font-hud)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '3px',
                        padding: '1px 4px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="1">Q1 (Do)</option>
                      <option value="2">Q2 (Plan)</option>
                      <option value="3">Q3 (Delegate)</option>
                      <option value="4">Q4 (Eliminate)</option>
                    </select>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,0,127,0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
            })
          ) : (
            <div style={{
              margin: 'auto',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '24px 0'
            }}>
              Vacío
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-hud)', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          MATRIZ DE EISENHOWER
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Clasifica tus recordatorios y tareas según su urgencia e importancia para optimizar tu tiempo.
        </p>
      </div>

      {/* Grid de 4 cuadrantes */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '16px',
        minHeight: 0 // Asegura que funcione scrollbar interno
      }}>
        {/* Q1: Urgente e Importante */}
        {renderQuadrant(
          "Q1: Urgente / Importante",
          q1,
          1,
          "255, 0, 127", // Pink RGB
          <ShieldAlert size={14} />,
          "HAZLO AHORA MISMO"
        )}

        {/* Q2: Importante / No Urgente */}
        {renderQuadrant(
          "Q2: Importante / No Urgente",
          q2,
          2,
          "0, 136, 255", // Sapphire RGB
          <Star size={14} />,
          "PLANIFICA E INVIERTE"
        )}

        {/* Q3: Urgente / No Importante */}
        {renderQuadrant(
          "Q3: Urgente / No Importante",
          q3,
          3,
          "255, 159, 0", // Amber RGB
          <Activity size={14} />,
          "DELEGA O SINO AL CORTO PLAZO"
        )}

        {/* Q4: No Urgente / No Importante */}
        {renderQuadrant(
          "Q4: No Urgente / No Importante",
          q4,
          4,
          "71, 85, 105", // Gray RGB
          <Trash2 size={14} />,
          "ELIMINA O POSPÓN"
        )}
      </div>

    </div>
  );
}
