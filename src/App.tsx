import { useState, useEffect } from 'react';
import { Task, AppSettings } from './types';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import MatrixView from './views/MatrixView';
import TimelineView from './views/TimelineView';
import SettingsView from './views/SettingsView';
import TelemetryView from './views/TelemetryView';
import FocusMode from './components/FocusMode';
import CommandPalette from './components/CommandPalette';
import QuickAddBox from './components/QuickAddBox';
import AlarmModalView from './views/AlarmModalView';
import OverlayView from './views/OverlayView';

type ActiveView = 'dashboard' | 'matrix' | 'timeline' | 'telemetry' | 'settings';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isQuickAddRoute, setIsQuickAddRoute] = useState(false);
  const [isAlarmModalRoute, setIsAlarmModalRoute] = useState(false);
  const [isOverlayRoute, setIsOverlayRoute] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // --- Cargar Ajustes y Hash en Primer Arranque ---
  useEffect(() => {
    // Detectar rutas especiales por hash
    const checkHashRoute = () => {
      setIsQuickAddRoute(window.location.hash === '#/quick-add');
      setIsAlarmModalRoute(window.location.hash.startsWith('#/alarm-modal'));
      setIsOverlayRoute(window.location.hash === '#/overlay');
    };
    checkHashRoute();
    window.addEventListener('hashchange', checkHashRoute);

    // Cargar Datos
    loadAllData();

    return () => window.removeEventListener('hashchange', checkHashRoute);
  }, []);

  const loadAllData = async () => {
    try {
      const t = await window.cyberGoAPI.getTasks();
      const s = await window.cyberGoAPI.getSettings();
      setTasks(t);
      setSettings(s);
      applyThemeVariables(s.theme);
    } catch (e) {
      console.error('Failed to load database content:', e);
    }
  };

  // --- Escuchar Eventos IPC Externos del Backend (Tray y Toasts) ---
  useEffect(() => {
    // Escuchar actualizaciones de tareas completadas/pospuestas remotamente
    const unsubscribeUpdated = window.cyberGoAPI.onTaskUpdatedExternal(() => {
      loadAllData();
    });

    // Escuchar click en tarea del tray para abrir el modo enfoque directamente
    const unsubscribeFocus = window.cyberGoAPI.onFocusTask((taskId: string) => {
      window.cyberGoAPI.getTasks().then(allTasks => {
        const found = allTasks.find(t => t.id === taskId);
        if (found) {
          setActiveView('dashboard');
          setFocusTask(found);
        }
      });
    });

    // Escuchar cambios de configuración remotos
    const unsubscribeSettings = window.cyberGoAPI.onSettingChanged((data) => {
      if (data.key === 'theme') {
        applyThemeVariables(data.value);
        setSettings(prev => prev ? { ...prev, theme: data.value } : null);
      }
    });

    // Escuchar cuando una tarea activa de alarma se dispara en segundo plano (para reproducir sonido de advertencia local)
    const unsubscribeTriggered = window.cyberGoAPI.onTaskTriggered(() => {
      // Si la ventana está en primer plano, reproducimos un sutil pitido HUD
      if (settings?.soundEnabled) {
        playDigitalBeep();
      }
      loadAllData(); // Recargar datos
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeFocus();
      unsubscribeSettings();
      unsubscribeTriggered();
    };
  }, [settings]);

  // --- Escuchar Atajos de Teclado del Frontend ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar atajos si el usuario escribe en una caja de texto
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Aplicar Colores de Tema HUD en CSS Variables ---
  const applyThemeVariables = (theme: AppSettings['theme']) => {
    const root = document.documentElement;
    if (theme === 'sapphire') {
      root.style.setProperty('--theme-color', 'var(--accent-sapphire)');
      root.style.setProperty('--theme-color-glow', 'var(--accent-sapphire-glow)');
    } else if (theme === 'amber') {
      root.style.setProperty('--theme-color', 'var(--accent-amber)');
      root.style.setProperty('--theme-color-glow', 'var(--accent-amber-glow)');
    } else if (theme === 'pink') {
      root.style.setProperty('--theme-color', 'var(--accent-pink)');
      root.style.setProperty('--theme-color-glow', 'var(--accent-pink-glow)');
    } else if (theme === 'emerald') {
      root.style.setProperty('--theme-color', 'var(--accent-emerald)');
      root.style.setProperty('--theme-color-glow', 'var(--accent-emerald-glow)');
    }
  };

  // Sutil pitido digital sintetizado
  const playDigitalBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.error(e);
    }
  };

  // --- Modificar Datos (Tasks/Settings CRUD) ---
  const handleSaveTask = async (task: Task) => {
    try {
      await window.cyberGoAPI.saveTask(task);
      loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await window.cyberGoAPI.deleteTask(id);
      loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllTasks = async () => {
    try {
      // Borrar todas las tareas
      for (const t of tasks) {
        await window.cyberGoAPI.deleteTask(t.id);
      }
      loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      await window.cyberGoAPI.saveSettings(newSettings);
      setSettings(newSettings);
      applyThemeVariables(newSettings.theme);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteCommand = (cmd: string) => {
    if (cmd === '/view dashboard') setActiveView('dashboard');
    else if (cmd === '/view matrix') setActiveView('matrix');
    else if (cmd === '/view timeline') setActiveView('timeline');
    else if (cmd === '/view settings') setActiveView('settings');
    else if (cmd === '/focus') {
      if (tasks.length > 0) {
        setFocusTask(tasks.find(t => !t.completed) || null);
      } else {
        setFocusTask(null);
      }
    } else if (cmd === '/clear-completed') {
      tasks.forEach(t => {
        if (t.completed) handleDeleteTask(t.id);
      });
    } else if (cmd === '/export') {
      // Desencadenar exportación
      document.querySelector('button[title*="EXPORTAR"]') ? (document.querySelector('button[title*="EXPORTAR"]') as HTMLButtonElement).click() : null;
    } else if (cmd === '/theme sapphire') handleSaveSettings({ ...settings!, theme: 'sapphire' });
    else if (cmd === '/theme amber') handleSaveSettings({ ...settings!, theme: 'amber' });
    else if (cmd === '/theme pink') handleSaveSettings({ ...settings!, theme: 'pink' });
    else if (cmd === '/theme emerald') handleSaveSettings({ ...settings!, theme: 'emerald' });
  };

  // --- Renderizar Vistas Especiales Aisladas ---
  if (isQuickAddRoute) {
    return <QuickAddBox />;
  }

  if (isAlarmModalRoute) {
    return <AlarmModalView />;
  }

  if (isOverlayRoute) {
    return <OverlayView />;
  }

  if (!settings) {
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
        letterSpacing: '0.15em',
        color: 'var(--accent-sapphire)'
      }}>
        INICIALIZANDO MOTOR CYBERGO...
      </div>
    );
  }

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="app-container">
      {/* Title Bar Draggable */}
      <TitleBar title="CYBERGO v1.0.0" />

      <div className="app-content">
        {/* Navigation Sidebar */}
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Workspace views */}
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          {activeView === 'dashboard' && (
            <DashboardView
              tasks={tasks}
              settings={settings}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
              onStartFocus={setFocusTask}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {activeView === 'matrix' && (
            <MatrixView
              tasks={tasks}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
              onStartFocus={setFocusTask}
            />
          )}

          {activeView === 'timeline' && (
            <TimelineView
              tasks={tasks}
              onStartFocus={setFocusTask}
            />
          )}

          {activeView === 'telemetry' && (
            <TelemetryView tasks={tasks} />
          )}

          {activeView === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onClearAllTasks={handleClearAllTasks}
              tasksCount={tasks.length}
              completedTasksCount={completedCount}
            />
          )}

          {/* Status Bar */}
          <footer style={{
            height: '24px',
            background: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--glass-border)',
            padding: '0 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            fontFamily: 'var(--font-hud)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span>Tareas Pendientes: {tasks.length - completedCount}</span>
              <span>Logros: {completedCount}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ color: 'var(--theme-color)', textShadow: '0 0 5px var(--theme-color-glow)' }}>
                ● CONECTADO A BASE DE DATOS ATÓMICA
              </span>
              <span>Atajo: Alt+Space</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Focus Mode Overlay */}
      {focusTask !== null && (
        <FocusMode
          task={focusTask}
          settings={settings}
          onClose={() => setFocusTask(null)}
          onCompleteTask={(taskId) => {
            const t = tasks.find(x => x.id === taskId);
            if (t) handleToggleComplete(t);
          }}
        />
      )}

      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={tasks}
        onSelectTask={(id) => {
          const t = tasks.find(x => x.id === id);
          if (t) setFocusTask(t);
        }}
        onExecuteCommand={handleExecuteCommand}
      />
    </div>
  );

  function handleToggleComplete(task: Task) {
    handleSaveTask({
      ...task,
      completed: true,
      completedAt: new Date().toISOString()
    });
  }
}
