import React, { useState, useEffect } from 'react';
import { AppSettings, BackupInfo } from '../types';
import { Volume2, ShieldAlert, Key, RefreshCw, HardDrive, Download, Upload, Trash2, CheckCircle, ListTodo } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllTasks: () => void;
  tasksCount: number;
  completedTasksCount: number;
}

export default function SettingsView({
  settings,
  onSaveSettings,
  onClearAllTasks,
  tasksCount,
  completedTasksCount
}: SettingsViewProps) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [autostartActive, setAutostartActive] = useState(false);

  // Cargar respaldos e información de inicio
  useEffect(() => {
    loadBackups();
    checkAutostart();
  }, []);

  const loadBackups = async () => {
    try {
      const b = await window.cyberGoAPI.getBackups();
      setBackups(b);
    } catch (e) {
      console.error(e);
    }
  };

  const checkAutostart = async () => {
    try {
      const enabled = await window.cyberGoAPI.getAutoStart();
      setAutostartActive(enabled);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAutostart = async () => {
    try {
      const target = !autostartActive;
      await window.cyberGoAPI.setAutoStart(target);
      setAutostartActive(target);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await window.cyberGoAPI.createBackup();
      loadBackups();
      alert("Copia de seguridad generada con éxito.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (confirm(`¿Estás seguro que deseas restaurar la copia de seguridad "${filename}"? Esta acción reemplazará la base de datos actual.`)) {
      try {
        await window.cyberGoAPI.restoreBackup(filename);
        alert("Copia de seguridad restaurada correctamente. Recargando base de datos...");
        window.location.reload();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleExportData = async () => {
    try {
      // En un entorno de producción, abriríamos un Save Dialog de Electron.
      // Para simplificar, descargamos el archivo JSON directamente usando el navegador.
      const tasks = await window.cyberGoAPI.getTasks();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, settings }));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "cybergo_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.tasks)) {
            // Guardar tareas en lote
            for (const task of parsed.tasks) {
              await window.cyberGoAPI.saveTask(task);
            }
            if (parsed.settings) {
              onSaveSettings(parsed.settings);
            }
            alert("Base de datos importada con éxito. Reiniciando...");
            window.location.reload();
          } else {
            alert("Formato de archivo de copia de seguridad no válido.");
          }
        } catch (err) {
          alert("Error al parsear el archivo de copia de seguridad.");
        }
      };
    }
  };

  return (
    <div className="view-container" style={{ overflowY: 'auto' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-hud)', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          CONFIGURACIÓN DE CYBERGO
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Configura atajos de teclado, tiempos Pomodoro, y gestiona copias de seguridad de alta seguridad.
        </p>
      </div>

      {/* Grid Contenedor de Ajustes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Panel Izquierdo: Ajustes Generales y Pomodoro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tarjeta Ajustes Generales */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Volume2 size={15} /> Preferencias del Sistema
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Autostart */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Iniciar con Windows</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Arrancar CyberGo automáticamente al iniciar sesión.</div>
                </div>
                <button
                  onClick={handleToggleAutostart}
                  className={`hud-btn ${autostartActive ? 'hud-btn-active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  {autostartActive ? 'ACTIVO' : 'INACTIVO'}
                </button>
              </div>

              {/* Sonidos Habilitados */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Efectos de Alarma Sonoros</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Habilitar alertas audibles en notificaciones nativas y temporizador.</div>
                </div>
                <button
                  onClick={() => onSaveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                  className={`hud-btn ${settings.soundEnabled ? 'hud-btn-active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  {settings.soundEnabled ? 'ACTIVO' : 'MUTED'}
                </button>
              </div>

              {/* Volumen */}
              {settings.soundEnabled && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                    <span>Volumen de Alerta</span>
                    <span style={{ fontFamily: 'var(--font-hud)', color: 'var(--theme-color)' }}>{Math.round(settings.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={(e) => onSaveSettings({ ...settings, soundVolume: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      accentColor: 'var(--theme-color)',
                      height: '4px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '2px',
                      marginTop: '8px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta Módulo Pomodoro */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Volume2 size={15} /> Parámetros de Enfoque Pomodoro
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tiempo Enfoque */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                  <span>Tiempo de Trabajo (Enfoque)</span>
                  <span style={{ fontFamily: 'var(--font-hud)', color: 'var(--theme-color)' }}>{settings.pomodoroWorkTime} Minutos</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={settings.pomodoroWorkTime}
                  onChange={(e) => onSaveSettings({ ...settings, pomodoroWorkTime: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    accentColor: 'var(--theme-color)',
                    height: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    marginTop: '8px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Tiempo Descanso */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                  <span>Tiempo de Descanso</span>
                  <span style={{ fontFamily: 'var(--font-hud)', color: 'var(--theme-color)' }}>{settings.pomodoroBreakTime} Minutos</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={settings.pomodoroBreakTime}
                  onChange={(e) => onSaveSettings({ ...settings, pomodoroBreakTime: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    accentColor: 'var(--theme-color)',
                    height: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    marginTop: '8px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tarjeta Atajos de Teclado */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Key size={15} /> Atajos de Teclado Globales
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ventana Quick-Add (Creación rápida)</span>
                <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'var(--font-hud)', fontSize: '11px', color: 'var(--accent-cyan)', border: '1px solid rgba(255,255,255,0.08)' }}>ALT + SPACE</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Abrir Paleta de Comandos</span>
                <kbd style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'var(--font-hud)', fontSize: '11px', color: 'var(--accent-cyan)', border: '1px solid rgba(255,255,255,0.08)' }}>CTRL + K</kbd>
              </div>
            </div>
          </div>

        </div>

        {/* Panel Derecho: Copias de Seguridad y Datos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Gestión de Respaldos de Alta Seguridad */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive size={15} /> Respaldos Atómicos (10 Niveles)
              </h2>
              <button
                onClick={handleCreateBackup}
                className="hud-btn"
                style={{ padding: '4px 8px', fontSize: '10px' }}
              >
                RESPALDAR AHORA
              </button>
            </div>

            {/* List backups */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              padding: '6px'
            }}>
              {backups.length > 0 ? (
                backups.map(b => (
                  <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.015)', borderRadius: '4px', fontSize: '11px' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{b.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>Modificado: {new Date(b.timestamp).toLocaleString()} | {(b.size / 1024).toFixed(2)} KB</div>
                    </div>
                    <button
                      onClick={() => handleRestoreBackup(b.name)}
                      className="hud-btn"
                      style={{ padding: '2px 6px', fontSize: '9px', borderColor: 'rgba(0,255,135,0.15)', color: 'var(--accent-emerald)' }}
                    >
                      Restaurar
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ margin: 'auto', padding: '20px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Ningún respaldo generado.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
              <ShieldAlert size={12} color="var(--accent-amber)" />
              <span>CyberGo mantiene copias rodantes automáticas de seguridad de manera segura.</span>
            </div>
          </div>

          {/* Importar / Exportar / Limpiar */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <RefreshCw size={15} /> Mantenimiento de Base de Datos
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Import/Export Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={handleExportData}
                  className="hud-btn"
                  style={{ justifyContent: 'center' }}
                >
                  <Download size={14} /> EXPORTAR JSON
                </button>
                
                <label className="hud-btn" style={{ justifyContent: 'center', cursor: 'pointer' }}>
                  <Upload size={14} /> IMPORTAR JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Clear DB */}
              <button
                onClick={() => {
                  if (confirm("¿CUIDADO! ¿Estás seguro que deseas borrar TODAS las tareas permanentemente? Esta acción no se puede deshacer.")) {
                    onClearAllTasks();
                    alert("Base de datos limpia.");
                  }
                }}
                className="hud-btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  borderColor: 'rgba(255,0,127,0.3)',
                  color: 'var(--accent-pink)',
                  background: 'rgba(255,0,127,0.02)'
                }}
              >
                <Trash2 size={14} /> BORRAR TODOS LOS DATOS
              </button>
            </div>
          </div>

          {/* Estadísticas de Operación */}
          <div className="glass-panel" style={{ padding: '16px 20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} color="var(--accent-emerald)" /> Métricas de Rendimiento
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '10px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tareas Activas</div>
                <div style={{ fontSize: '18px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>{tasksCount - completedTasksCount}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', padding: '10px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logros Completados</div>
                <div style={{ fontSize: '18px', fontFamily: 'var(--font-hud)', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>{completedTasksCount}</div>
              </div>
            </div>
          </div>

          {/* Smart Lists Management */}
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(10, 10, 15, 0.4)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ListTodo size={15} /> Vistas Guardadas (Smart Lists)
            </h2>
            {settings.smartLists.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {settings.smartLists.map(list => (
                  <div key={list.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.015)', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{list.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', textTransform: 'uppercase', marginTop: '2px' }}>
                        Filtro: {list.filter} | Categoría: {list.category} {list.searchQuery ? `| Búsqueda: ${list.searchQuery}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => onSaveSettings({ ...settings, smartLists: settings.smartLists.filter(l => l.id !== list.id) })}
                      className="hud-btn"
                      style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--accent-pink)', borderColor: 'rgba(255,0,127,0.15)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                No tienes vistas personalizadas guardadas. Crea una desde el Dashboard usando "+ Guardar Vista".
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
