import { ListTodo, Grid2X2, Activity, Settings, FolderOpen, BarChart3 } from 'lucide-react';

type ActiveView = 'dashboard' | 'matrix' | 'timeline' | 'telemetry' | 'settings';

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as ActiveView, label: 'Dashboard', icon: <ListTodo size={16} /> },
    { id: 'matrix' as ActiveView, label: 'Matriz Eisenhower', icon: <Grid2X2 size={16} /> },
    { id: 'timeline' as ActiveView, label: 'Cronograma', icon: <Activity size={16} /> },
    { id: 'telemetry' as ActiveView, label: 'Telemetría', icon: <BarChart3 size={16} /> },
    { id: 'settings' as ActiveView, label: 'Configuración', icon: <Settings size={16} /> },
  ];

  const handleOpenDataFolder = () => {
    window.cyberGoAPI.openDataFolder();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-menu">
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-hud)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          paddingLeft: '14px',
          marginBottom: '16px'
        }}>
          Navegación HUD
        </div>
        
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Acceso Rápido a Carpeta de Datos en la Base de la Sidebar */}
      <div style={{ padding: '0 8px' }}>
        <button
          onClick={handleOpenDataFolder}
          className="hud-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '10px',
            padding: '6px 8px',
            borderColor: 'rgba(255,255,255,0.03)'
          }}
          title="Abrir carpeta de persistencia local JSON"
        >
          <FolderOpen size={12} /> DATOS LOCALES
        </button>
      </div>
    </aside>
  );
}
