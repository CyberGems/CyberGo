import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, CheckCircle, Eye, Sliders, Play, Download, Upload } from 'lucide-react';
import { Task } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onExecuteCommand: (cmd: string) => void;
}

interface CommandItem {
  icon: React.ReactNode;
  label: string;
  command: string;
  description: string;
}

export default function CommandPalette({
  isOpen,
  onClose,
  tasks,
  onSelectTask,
  onExecuteCommand
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { icon: <Eye size={16} />, label: "Ver Dashboard", command: "/view dashboard", description: "Cambiar a la vista predeterminada de tareas" },
    { icon: <Eye size={16} />, label: "Ver Matriz de Eisenhower", command: "/view matrix", description: "Cambiar a la vista de cuadrantes de prioridad" },
    { icon: <Eye size={16} />, label: "Ver Cronograma (Timeline)", command: "/view timeline", description: "Cambiar a la vista cronológica de agenda" },
    { icon: <Eye size={16} />, label: "Ver Configuración", command: "/view settings", description: "Ver ajustes e integraciones del sistema" },
    { icon: <Play size={16} />, label: "Iniciar Modo Enfoque", command: "/focus", description: "Iniciar temporizador de concentración Pomodoro" },
    { icon: <CheckCircle size={16} />, label: "Limpiar Completadas", command: "/clear-completed", description: "Eliminar permanentemente tareas completadas" },
    { icon: <Download size={16} />, label: "Exportar Copia de Seguridad", command: "/export", description: "Respaldar base de datos a un archivo JSON" },
    { icon: <Upload size={16} />, label: "Importar Base de Datos", command: "/import", description: "Restaurar base de datos desde un archivo JSON" },
    { icon: <Sliders size={16} />, label: "Tema Sapphire (Azul)", command: "/theme sapphire", description: "Cambiar paleta visual a Sapphire" },
    { icon: <Sliders size={16} />, label: "Tema Amber (Naranja)", command: "/theme amber", description: "Cambiar paleta visual a Neon Amber" },
    { icon: <Sliders size={16} />, label: "Tema Cyber Pink (Rosa)", command: "/theme pink", description: "Cambiar paleta visual a Cyber Pink" },
    { icon: <Sliders size={16} />, label: "Tema Emerald (Verde)", command: "/theme emerald", description: "Cambiar paleta visual a Emerald Green" },
  ];

  // Filtrar comandos y tareas
  const filteredCommands = commands.filter(c => 
    c.label.toLowerCase().includes(search.toLowerCase()) || 
    c.command.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTasks = tasks
    .filter(t => !t.completed && t.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5); // Máximo 5 tareas en el palette

  const totalItemsCount = filteredCommands.length + filteredTasks.length;

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItemsCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItemsCount) % totalItemsCount);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, totalItemsCount, search]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const triggerSelection = () => {
    if (selectedIndex < filteredCommands.length) {
      // Es un comando
      const cmd = filteredCommands[selectedIndex];
      onExecuteCommand(cmd.command);
    } else {
      // Es una tarea
      const taskIndex = selectedIndex - filteredCommands.length;
      const task = filteredTasks[taskIndex];
      onSelectTask(task.id);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '80px'
    }}>
      <div 
        ref={containerRef}
        className="glass-panel" 
        style={{
          width: '600px',
          maxHeight: '450px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 30px rgba(var(--theme-color-glow), 0.2)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          background: 'rgba(10, 10, 15, 0.92)'
        }}
      >
        {/* Input de Búsqueda */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          gap: '12px'
        }}>
          <Search size={18} color="var(--text-secondary)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un comando o busca tareas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-text)',
              fontSize: '15px',
              width: '100%'
            }}
          />
          <Terminal size={14} color="var(--text-muted)" />
        </div>

        {/* Resultados */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px'
        }}>
          {/* Comandos */}
          {filteredCommands.length > 0 && (
            <div>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '6px 12px',
                fontFamily: 'var(--font-hud)',
                letterSpacing: '0.05em'
              }}>
                Comandos del Sistema
              </div>
              {filteredCommands.map((cmd, index) => {
                const isActive = index === selectedIndex;
                return (
                  <div
                    key={cmd.command}
                    onClick={() => {
                      onExecuteCommand(cmd.command);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--theme-color)' : '3px solid transparent',
                      transition: 'all 0.1s'
                    }}
                  >
                    <div style={{
                      color: isActive ? 'var(--theme-color)' : 'var(--text-secondary)',
                      marginRight: '12px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {cmd.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 500,
                        fontFamily: 'var(--font-hud)'
                      }}>
                        {cmd.label} <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>{cmd.command}</span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}>
                        {cmd.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tareas */}
          {filteredTasks.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '6px 12px',
                fontFamily: 'var(--font-hud)',
                letterSpacing: '0.05em'
              }}>
                Tareas Coincidentes
              </div>
              {filteredTasks.map((task, index) => {
                const globalIndex = filteredCommands.length + index;
                const isActive = globalIndex === selectedIndex;
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      onSelectTask(task.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--theme-color)' : '3px solid transparent',
                      transition: 'all 0.1s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '12px'
                    }}>
                      <span className={`priority-dot priority-dot-${task.priority}`} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 500
                      }}>
                        {task.title}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-hud)'
                      }}>
                        Categoría: {task.category.toUpperCase()} {task.dueDate ? `| Vence: ${new Date(task.dueDate).toLocaleString()}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalItemsCount === 0 && (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No se encontraron comandos ni tareas para "{search}"
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)' }}>
            ↑↓ NAVEGAR  |  ENTER SELECCIONAR  |  ESC CERRAR
          </span>
        </div>
      </div>
    </div>
  );
}
