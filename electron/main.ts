import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, globalShortcut, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { exec } from 'child_process';
import { Task, AppSettings } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const isDev = !app.isPackaged;

// --- Paths de Datos ---
const userDataPath = app.getPath('userData');
const tasksFilePath = path.join(userDataPath, 'tasks.json');
const settingsFilePath = path.join(userDataPath, 'settings.json');
const backupsDirPath = path.join(userDataPath, 'backups');

// --- Icon Path ---
let iconPath = path.join(__dirname, '..', 'public', 'icon.png');
if (!isDev) {
  iconPath = path.join(app.getAppPath(), 'dist', 'icon.png');
}
if (!fs.existsSync(iconPath)) {
  const fallbackIcon = path.join(isDev ? path.join(__dirname, '..', 'public') : path.join(app.getAppPath(), 'dist'), 'icon.ico');
  if (fs.existsSync(fallbackIcon)) iconPath = fallbackIcon;
}

// --- Ventanas y Tray ---
let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let schedulerInterval: NodeJS.Timeout | null = null;
let escalationInterval: NodeJS.Timeout | null = null;
let alarmModalWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

// Motor de Escalación de Alarmas
const triggeredTasks = new Map<string, { task: Task; level: number; triggeredAt: number }>();

// --- Configuración por Defecto ---
const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  theme: 'sapphire',
  globalHotkey: 'Alt+Space',
  autoStart: false,
  closeToTray: true,
  minimizeToTray: true,
  soundEnabled: true,
  soundVolume: 0.8,
  pomodoroWorkTime: 25,
  pomodoroBreakTime: 5,
  smartLists: []
};

// --- Registro de Protocolo Personalizado (para acciones en Notificaciones) ---
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('cybergo', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('cybergo');
}

// ============================================================================
// GESTOR DE BASE DE DATOS ATÓMICA JSON & BACKUPS
// ============================================================================

function initDatabase() {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  if (!fs.existsSync(backupsDirPath)) {
    fs.mkdirSync(backupsDirPath, { recursive: true });
  }

  // Cargar/Inicializar Tareas
  if (!fs.existsSync(tasksFilePath)) {
    saveTasksAtomic([]);
  }

  // Cargar/Inicializar Configuración
  if (!fs.existsSync(settingsFilePath)) {
    saveSettingsAtomic(DEFAULT_SETTINGS);
  }
}

// Escritura atómica para evitar corrupción
function saveTasksAtomic(tasks: Task[]) {
  const tempPath = tasksFilePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(tasks, null, 2), 'utf-8');
    fs.renameSync(tempPath, tasksFilePath);
    return true;
  } catch (err) {
    console.error('Failed to write tasks database atomically:', err);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return false;
  }
}

function loadTasks(): Task[] {
  try {
    if (fs.existsSync(tasksFilePath)) {
      const content = fs.readFileSync(tasksFilePath, 'utf-8');
      return JSON.parse(content) as Task[];
    }
  } catch (err) {
    console.error('Failed to read tasks database, loading backup if available:', err);
    // Intentar cargar la última copia de seguridad
    const backups = getBackupsList();
    if (backups.length > 0) {
      const latestBackupPath = path.join(backupsDirPath, backups[0].name);
      try {
        const backupContent = fs.readFileSync(latestBackupPath, 'utf-8');
        const tasks = JSON.parse(backupContent) as Task[];
        saveTasksAtomic(tasks); // Restaurar base activa
        return tasks;
      } catch (backupErr) {
        console.error('Failed to read backup:', backupErr);
      }
    }
  }
  return [];
}

function saveSettingsAtomic(settings: AppSettings) {
  const tempPath = settingsFilePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf-8');
    fs.renameSync(tempPath, settingsFilePath);
    return true;
  } catch (err) {
    console.error('Failed to write settings atomically:', err);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return false;
  }
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const content = fs.readFileSync(settingsFilePath, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) } as AppSettings;
    }
  } catch (err) {
    console.error('Failed to read settings, restoring defaults:', err);
  }
  return DEFAULT_SETTINGS;
}

// Copia de seguridad rodante (Máximo 10 niveles)
function createBackupFile(): boolean {
  try {
    const timestamp = Date.now();
    const backupName = `tasks_backup_${timestamp}.json`;
    const destPath = path.join(backupsDirPath, backupName);
    
    if (fs.existsSync(tasksFilePath)) {
      fs.copyFileSync(tasksFilePath, destPath);
      
      // Limpiar backups antiguos si superan 10
      const list = getBackupsList();
      if (list.length > 10) {
        for (let i = 10; i < list.length; i++) {
          const toDelete = path.join(backupsDirPath, list[i].name);
          if (fs.existsSync(toDelete)) fs.unlinkSync(toDelete);
        }
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to create backup:', err);
  }
  return false;
}

function getBackupsList() {
  try {
    if (!fs.existsSync(backupsDirPath)) return [];
    const files = fs.readdirSync(backupsDirPath);
    return files
      .filter(f => f.startsWith('tasks_backup_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(backupsDirPath, f);
        const stat = fs.statSync(fullPath);
        const timestampStr = f.replace('tasks_backup_', '').replace('.json', '');
        return {
          name: f,
          timestamp: parseInt(timestampStr, 10) || stat.mtimeMs,
          size: stat.size
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Más nuevos primero
  } catch (e) {
    return [];
  }
}

// ============================================================================
// PUENTE DE NOTIFICACIONES NATIVAS DE WINDOWS (Powershell Toast Bridge)
// ============================================================================

function showNativeNotification(task: Task) {
  if (process.platform !== 'win32') return;

  const appSettings = loadSettings();
  if (!appSettings.soundEnabled) {
    // Si el sonido está desactivado, podemos usar silent en XML
  }

  // Definir textos limpios de comillas
  const cleanTitle = task.title.replace(/"/g, '\"');
  const cleanCategory = task.category.replace(/"/g, '\"').toUpperCase();
  const cleanNotes = (task.notes || 'CyberGo Reminder').replace(/"/g, '\"');
  
  // Prioridad en texto
  const priorityText = task.priority === 1 ? '🔴 URGENTE & IMPORTANTE' :
                       task.priority === 2 ? '🔵 IMPORTANTE' :
                       task.priority === 3 ? '🟡 URGENTE' : '⚪ NORMAL';

  const xmlPayload = `
<toast launch="cybergo://open" duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>${cleanTitle}</text>
      <text>${priorityText} | CATEGORÍA: ${cleanCategory}</text>
      <text>${cleanNotes}</text>
    </binding>
  </visual>
  <actions>
    <action content="Completar" arguments="cybergo://complete?id=${task.id}" activationType="protocol"/>
    <action content="Posponer 15m" arguments="cybergo://snooze?id=${task.id}&amp;m=15" activationType="protocol"/>
  </actions>
  <audio src="ms-winsoundevent:Notification.Reminder"/>
</toast>
`.replace(/\n/g, '').trim();

  // Guardar XML temporal para que Powershell lo lea de forma segura
  const tempXmlPath = path.join(userDataPath, 'temp_notification.xml');
  try {
    fs.writeFileSync(tempXmlPath, xmlPayload, 'utf-8');

    // Registrar AUMID (Application User Model ID) y lanzar notificación mediante PowerShell
    // Nota: Usamos System.Xml.XmlDocument para evitar problemas de compatibilidad y asegurar carga WinRT
    const psCommand = `
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml([IO.File]::ReadAllText('${tempXmlPath.replace(/'/g, "''")}'))
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("com.cybergems.cybergo").Show($toast)
    `.replace(/\n/g, ' ').trim();

    exec(`powershell -Command "${psCommand}"`, (err) => {
      if (err) {
        console.error('Failed to trigger native toast notification via PowerShell:', err);
        // Fallback a notificación normal de Electron si falla el puente
        const fallbackNotification = new (require('electron').Notification)({
          title: cleanTitle,
          body: `${priorityText} | ${cleanNotes}`,
          icon: iconPath,
          silent: !appSettings.soundEnabled
        });
        fallbackNotification.show();
      } else {
        // Eliminar archivo temporal tras el envío
        setTimeout(() => {
          if (fs.existsSync(tempXmlPath)) fs.unlinkSync(tempXmlPath);
        }, 1000);
      }
    });
  } catch (writeErr) {
    console.error('Error writing notification XML:', writeErr);
  }
}

// ============================================================================
// MOTOR PROGRAMADOR DE ALARMAS Y CONEXIÓN CON TRAY
// ============================================================================

function startAlarmScheduler() {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(() => {
    const tasks = loadTasks();
    const now = new Date();
    let hasChanges = false;
    tasks.forEach(task => {
      if (task.completed || !task.dueDate) return;

      const dueTime = new Date(task.dueDate);
      const diffMs = dueTime.getTime() - now.getTime();

      // --- Pre-Alarma Inteligente ---
      if (!task.preAlarmSent && diffMs > 0) {
        const preAlarmMinutes = task.priority === 1 ? 15 : task.priority === 2 ? 5 : 0;
        if (preAlarmMinutes > 0 && diffMs <= preAlarmMinutes * 60 * 1000) {
          task.preAlarmSent = true;
          hasChanges = true;
          showPreAlarmNotification(task);
        }
      }

      // --- Alarma Principal ---
      if (!task.reminderTriggered && dueTime <= now) {
        task.reminderTriggered = true;
        hasChanges = true;
        
        // Emitir al frontend si la ventana está activa
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-triggered', task);
        }
        
        // Mostrar notificación de Windows (Nivel 1)
        showNativeNotification(task);

        // Registrar para motor de escalación
        triggeredTasks.set(task.id, { task, level: 1, triggeredAt: Date.now() });
        startEscalationEngine();
      }
    });

    if (hasChanges) {
      saveTasksAtomic(tasks);
    }
  }, 1000); // Revisar cada segundo
}

function stopAlarmScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  stopEscalationEngine();
}

// ============================================================================
// MOTOR DE ESCALACIÓN DE ALARMAS (Hypermodern Alert Escalation)
// ============================================================================

function startEscalationEngine() {
  if (escalationInterval) return;

  escalationInterval = setInterval(() => {
    const now = Date.now();
    const tasks = loadTasks();

    triggeredTasks.forEach((meta, taskId) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task || task.completed) {
        triggeredTasks.delete(taskId);
        return;
      }

      const elapsedMin = (now - meta.triggeredAt) / (1000 * 60);

      // Nivel 2: 2 minutos sin atender → Flash frame + beep + notificación urgente
      if (meta.level === 1 && elapsedMin >= 2) {
        meta.level = 2;
        triggeredTasks.set(taskId, meta);
        showEscalationNotification(task, 2);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.flashFrame(true);
        }
        playSystemBeep(800, 0.4);
      }

      // Nivel 3: 5 minutos sin atender + P1 → Ventana modal bloqueante
      if (meta.level === 2 && elapsedMin >= 5 && task.priority === 1) {
        meta.level = 3;
        triggeredTasks.set(taskId, meta);
        showEscalationNotification(task, 3);
        createAlarmModalWindow(task);
        playSystemBeep(1200, 0.6);
      }
    });

    if (triggeredTasks.size === 0) {
      stopEscalationEngine();
    }
  }, 15000); // Revisar cada 15 segundos
}

function stopEscalationEngine() {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
  }
}

function playSystemBeep(frequency: number, durationSec: number) {
  if (process.platform !== 'win32') return;
  try {
    const ps = `[console]::beep(${frequency}, ${Math.round(durationSec * 1000)})`;
    exec(`powershell -Command "${ps}"`);
  } catch (e) {
    // Ignorar errores de beep
  }
}

function showPreAlarmNotification(task: Task) {
  if (process.platform !== 'win32') return;
  const cleanTitle = task.title.replace(/"/g, '\"');
  const xmlPayload = `
<toast launch="cybergo://open" duration="short">
  <visual>
    <binding template="ToastGeneric">
      <text>⏳ Próximo: ${cleanTitle}</text>
      <text>La alarma se disparará en menos de ${task.priority === 1 ? '15' : '5'} minutos.</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Reminder"/>
</toast>
`.replace(/\n/g, '').trim();

  const tempXmlPath = path.join(userDataPath, `prealarm_${task.id}.xml`);
  try {
    fs.writeFileSync(tempXmlPath, xmlPayload, 'utf-8');
    const psCommand = `
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml([IO.File]::ReadAllText('${tempXmlPath.replace(/'/g, "''")}'))
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("com.cybergems.cybergo").Show($toast)
    `.replace(/\n/g, ' ').trim();
    exec(`powershell -Command "${psCommand}"`, (err) => {
      if (!err) {
        setTimeout(() => { if (fs.existsSync(tempXmlPath)) fs.unlinkSync(tempXmlPath); }, 2000);
      }
    });
  } catch (e) {
    console.error('Pre-alarm failed:', e);
  }
}

function showEscalationNotification(task: Task, level: number) {
  if (process.platform !== 'win32') return;
  const cleanTitle = task.title.replace(/"/g, '\"');
  const titleText = level === 2 ? `⚠️ ALARMA NO ATENDIDA: ${cleanTitle}` : `🚨 CRÍTICO: ${cleanTitle}`;
  const bodyText = level === 2 
    ? `Han pasado 2 minutos. Por favor, atiende esta tarea de prioridad P${task.priority}.`
    : `ALTA PRIORIDAD (P1) SIN ATENDER. Se requiere acción inmediata.`;

  const xmlPayload = `
<toast launch="cybergo://open" duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>${titleText}</text>
      <text>${bodyText}</text>
    </binding>
  </visual>
  <actions>
    <action content="Completar" arguments="cybergo://complete?id=${task.id}" activationType="protocol"/>
    <action content="Posponer 15m" arguments="cybergo://snooze?id=${task.id}&amp;m=15" activationType="protocol"/>
  </actions>
  <audio src="ms-winsoundevent:Notification.Looping.Alarm"/>
</toast>
`.replace(/\n/g, '').trim();

  const tempXmlPath = path.join(userDataPath, `escalation_${task.id}_${level}.xml`);
  try {
    fs.writeFileSync(tempXmlPath, xmlPayload, 'utf-8');
    const psCommand = `
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml([IO.File]::ReadAllText('${tempXmlPath.replace(/'/g, "''")}'))
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("com.cybergems.cybergo").Show($toast)
    `.replace(/\n/g, ' ').trim();
    exec(`powershell -Command "${psCommand}"`, (err) => {
      if (!err) {
        setTimeout(() => { if (fs.existsSync(tempXmlPath)) fs.unlinkSync(tempXmlPath); }, 2000);
      }
    });
  } catch (e) {
    console.error('Escalation notification failed:', e);
  }
}

function createAlarmModalWindow(task: Task) {
  if (alarmModalWindow && !alarmModalWindow.isDestroyed()) {
    alarmModalWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const modalWidth = 480;
  const modalHeight = 280;

  alarmModalWindow = new BrowserWindow({
    width: modalWidth,
    height: modalHeight,
    x: Math.round((screenWidth - modalWidth) / 2),
    y: Math.round((screenHeight - modalHeight) / 2),
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    backgroundColor: '#08080c',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  // Cargar la ventana principal pero con hash de modal (la app manejará el renderizado)
  if (isDev) {
    alarmModalWindow.loadURL(`http://localhost:5173/#/alarm-modal?taskId=${task.id}`);
  } else {
    alarmModalWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: `/alarm-modal?taskId=${task.id}` });
  }

  alarmModalWindow.on('closed', () => {
    alarmModalWindow = null;
  });
}

function closeAlarmModalWindow() {
  if (alarmModalWindow && !alarmModalWindow.isDestroyed()) {
    alarmModalWindow.close();
    alarmModalWindow = null;
  }
}

// ============================================================================
// MANEJO DE PROTOCOLOS (Acción rápida desde notificaciones)
// ============================================================================

function handleProtocolUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const taskId = parsedUrl.searchParams.get('id');
    
    if (parsedUrl.host === 'complete' && taskId) {
      const tasks = loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].completed = true;
        tasks[taskIndex].completedAt = new Date().toISOString();
        saveTasksAtomic(tasks);
        
        // Limpiar escalación
        triggeredTasks.delete(taskId);
        closeAlarmModalWindow();
        
        // Notificar al frontend para sincronizar
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-updated-external');
        }
      }
    } else if (parsedUrl.host === 'snooze' && taskId) {
      const minutesStr = parsedUrl.searchParams.get('m') || '15';
      const minutes = parseInt(minutesStr, 10);
      
      const tasks = loadTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const currentDueDate = new Date();
        currentDueDate.setMinutes(currentDueDate.getMinutes() + minutes);
        
        tasks[taskIndex].dueDate = currentDueDate.toISOString();
        tasks[taskIndex].reminderTriggered = false; // Resetear bandera de disparo de alarma
        tasks[taskIndex].preAlarmSent = false;
        saveTasksAtomic(tasks);

        // Limpiar escalación
        triggeredTasks.delete(taskId);
        closeAlarmModalWindow();

        // Notificar al frontend
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-updated-external');
        }
      }
    } else if (parsedUrl.host === 'add') {
      // Protocolo: cybergo://add?title=...&due=ISO&p=1&cat=work
      const title = parsedUrl.searchParams.get('title') || 'Nueva tarea';
      const dueStr = parsedUrl.searchParams.get('due');
      const priorityStr = parsedUrl.searchParams.get('p') || '4';
      const category = parsedUrl.searchParams.get('cat') || 'General';
      
      const newTask: Task = {
        id: Math.random().toString(36).substring(2, 15),
        title,
        category,
        priority: parseInt(priorityStr, 10) as 1 | 2 | 3 | 4,
        dueDate: dueStr ? new Date(dueStr).toISOString() : undefined,
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      const tasks = loadTasks();
      tasks.push(newTask);
      saveTasksAtomic(tasks);
      updateTrayMenu();
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('task-updated-external');
      }
    }
  } catch (err) {
    console.error('Failed to parse protocol URL:', url, err);
  }
}

// ============================================================================
// WINDOW CREATION AND MANAGEMENT
// ============================================================================

function restoreWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let bounds = {
    width: Math.min(1150, screenWidth - 100),
    height: Math.min(750, screenHeight - 100),
    x: undefined as number | undefined,
    y: undefined as number | undefined
  };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 960,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#08080c',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    show: false
  });

  mainWindow.center();

  // Guardar estado al salir
  mainWindow.on('close', (event) => {
    const settings = loadSettings();
    if (settings.closeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  mainWindow.on('minimize', () => {
    const settings = loadSettings();
    if (settings.minimizeToTray) {
      mainWindow?.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // Si se inicia escondido por autostart
    if (process.argv.includes('--hidden')) return;
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createQuickAddWindow() {
  quickAddWindow = new BrowserWindow({
    width: 550,
    height: 120,
    frame: false,
    resizable: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000', // Totalmente transparente para permitir blur nativo CSS
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  if (isDev) {
    // Apunta al puerto de Vite pero con una ruta específica
    quickAddWindow.loadURL('http://localhost:5173/#/quick-add');
  } else {
    quickAddWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/quick-add' });
  }

  // Ocultar si pierde el foco
  quickAddWindow.on('blur', () => {
    quickAddWindow?.hide();
  });
}

function toggleQuickAddWindow() {
  if (!quickAddWindow) return;

  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide();
  } else {
    // Centrar en la pantalla donde se encuentra el cursor del mouse
    const mousePos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(mousePos);
    
    const { x, y, width, height } = activeDisplay.bounds;
    const qWidth = 550;
    const qHeight = 120;
    
    const posX = x + (width - qWidth) / 2;
    const posY = y + (height - qHeight) / 3; // Ligeramente más arriba del centro vertical
    
    quickAddWindow.setBounds({
      x: Math.round(posX),
      y: Math.round(posY),
      width: qWidth,
      height: qHeight
    });
    
    quickAddWindow.show();
    quickAddWindow.focus();
    
    // Notificar al renderer para enfocar la caja de texto
    quickAddWindow.webContents.send('quick-add-open');
  }
}

function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 140,
    frame: false,
    resizable: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173/#/overlay');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' });
  }

  win.on('closed', () => {
    overlayWindow = null;
  });

  overlayWindow = win;
  return win;
}

function toggleOverlayWindow() {
  const win = overlayWindow || createOverlayWindow();

  if (win.isVisible()) {
    win.hide();
  } else {
    // Posicionar en esquina inferior derecha de la pantalla principal
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const oWidth = 320;
    const oHeight = 140;
    win.setBounds({
      x: screenWidth - oWidth - 20,
      y: screenHeight - oHeight - 20,
      width: oWidth,
      height: oHeight
    });
    win.show();
    win.focus();
  }
}

// ============================================================================
// SYSTEM TRAY MANAGEMENT
// ============================================================================

function createTrayMenuTemplate() {
  const settings = loadSettings();
  const tasks = loadTasks().filter(t => !t.completed).slice(0, 3); // Primeros 3 pendientes
  const isEs = settings.language === 'es';

  const menuItems: any[] = [
    { 
      label: 'CyberGo v1.0.0', 
      enabled: false 
    },
    { type: 'separator' },
    { 
      label: isEs ? 'Abrir CyberGo' : 'Open CyberGo', 
      click: restoreWindow 
    },
    { 
      label: isEs ? 'Añadir Rápido (Alt+Space)' : 'Quick Add (Alt+Space)', 
      click: toggleQuickAddWindow 
    },
    { type: 'separator' }
  ];

  // Listar tareas pendientes en el tray
  if (tasks.length > 0) {
    menuItems.push({ label: isEs ? 'Tareas Pendientes:' : 'Pending Tasks:', enabled: false });
    tasks.forEach(task => {
      menuItems.push({
        label: ` • [P${task.priority}] ${task.title}`,
        click: () => {
          restoreWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('focus-task', task.id);
          }
        }
      });
    });
    menuItems.push({ type: 'separator' });
  }

  menuItems.push({
    label: isEs ? 'Salir' : 'Quit',
    click: () => {
      isQuitting = true;
      app.quit();
    }
  });

  return menuItems;
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  try {
    const contextMenu = Menu.buildFromTemplate(createTrayMenuTemplate());
    tray.setContextMenu(contextMenu);
  } catch (err) {
    console.error('Failed to update tray menu:', err);
  }
}

function createTray() {
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('CyberGo — Recordatorios');
    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        restoreWindow();
      }
    });
  } catch (err) {
    console.error('Failed to create tray:', err);
  }
}

// ============================================================================
// ATADOS DE TECLADO Y ARRANQUE AUTOMÁTICO
// ============================================================================

function registerGlobalHotkeys() {
  const settings = loadSettings();
  globalShortcut.unregisterAll();

  try {
    const hotkey = settings.globalHotkey || 'Alt+Space';
    globalShortcut.register(hotkey, () => {
      toggleQuickAddWindow();
    });
    // Overlay Widget Toggle
    globalShortcut.register('Alt+Shift+Space', () => {
      toggleOverlayWindow();
    });
  } catch (err) {
    console.error('Failed to register global hotkey:', err);
  }
}

// ============================================================================
// IPC MAIN HANDLERS
// ============================================================================

function registerIpcHandlers() {
  // Window Management
  ipcMain.handle('window-minimize', () => {
    const settings = loadSettings();
    if (settings.minimizeToTray) {
      mainWindow?.hide();
    } else {
      mainWindow?.minimize();
    }
  });

  ipcMain.handle('window-maximize-toggle', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });

  ipcMain.handle('window-close', () => {
    const settings = loadSettings();
    if (settings.closeToTray) {
      mainWindow?.hide();
    } else {
      isQuitting = true;
      app.quit();
    }
  });

  ipcMain.handle('open-dev-tools', () => mainWindow?.webContents.openDevTools({ mode: 'detach' }));
  ipcMain.handle('open-data-folder', () => shell.openPath(userDataPath));

  // App States
  ipcMain.handle('app:is-quick-add', (event) => {
    return quickAddWindow && event.sender.id === quickAddWindow.webContents.id;
  });

  ipcMain.handle('app:close-quick-add', () => {
    quickAddWindow?.hide();
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return loadSettings();
  });

  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    const success = saveSettingsAtomic(settings);
    if (success) {
      registerGlobalHotkeys(); // Re-registrar atajos si cambiaron
      updateTrayMenu();
      // Notificar cambio de tema
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('setting-changed', { key: 'theme', value: settings.theme });
      }
    }
    return success;
  });

  ipcMain.handle('settings:set-auto-start', (_e, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true,
      args: enable ? ['--hidden'] : []
    });
    
    const settings = loadSettings();
    settings.autoStart = enable;
    saveSettingsAtomic(settings);
    return true;
  });

  ipcMain.handle('settings:get-auto-start', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  // Tasks CRUD
  ipcMain.handle('tasks:get-all', () => {
    return loadTasks();
  });

  ipcMain.handle('tasks:save', (_e, task: Task) => {
    const tasks = loadTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    saveTasksAtomic(tasks);
    updateTrayMenu();
    return task;
  });

  ipcMain.handle('tasks:delete', (_e, id: string) => {
    const tasks = loadTasks();
    const filtered = tasks.filter(t => t.id !== id);
    const success = saveTasksAtomic(filtered);
    updateTrayMenu();
    return success;
  });

  // Backup & Import/Export
  ipcMain.handle('data:export', async () => {
    if (!mainWindow) return false;
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar datos de CyberGo',
      defaultPath: 'cybergo-tasks-export.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) return false;

    try {
      const tasks = loadTasks();
      const settings = loadSettings();
      const exportData = {
        app: 'CyberGo',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tasks,
        settings
      };
      
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to export data:', err);
      return false;
    }
  });

  ipcMain.handle('data:import', async () => {
    if (!mainWindow) return false;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar datos a CyberGo',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) return false;

    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(content);
      
      if (data.app === 'CyberGo' && Array.isArray(data.tasks)) {
        // Crear backup antes de sobrescribir
        createBackupFile();
        
        saveTasksAtomic(data.tasks);
        if (data.settings) {
          saveSettingsAtomic({ ...DEFAULT_SETTINGS, ...data.settings });
          registerGlobalHotkeys();
        }
        
        updateTrayMenu();
        // Notificar al renderer
        mainWindow.webContents.send('task-updated-external');
        return true;
      }
    } catch (err) {
      console.error('Failed to import data:', err);
    }
    return false;
  });

  ipcMain.handle('data:get-backups', () => {
    return getBackupsList();
  });

  ipcMain.handle('data:restore-backup', (_e, name: string) => {
    const backupPath = path.join(backupsDirPath, name);
    if (fs.existsSync(backupPath)) {
      try {
        const content = fs.readFileSync(backupPath, 'utf-8');
        const tasks = JSON.parse(content) as Task[];
        
        // Crear backup actual por seguridad
        createBackupFile();
        
        saveTasksAtomic(tasks);
        updateTrayMenu();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-updated-external');
        }
        return true;
      } catch (e) {
        console.error('Failed to restore backup:', e);
      }
    }
    return false;
  });

  ipcMain.handle('data:create-backup', () => {
    return createBackupFile();
  });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Manejo de segunda instancia (ej: cuando se hace clic en una notificación nativa)
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('cybergo://'));
    if (url) {
      handleProtocolUrl(url);
    }
    restoreWindow();
  });

  app.whenReady().then(async () => {
    initDatabase();
    
    // Iniciar el programador de alarmas de fondo
    startAlarmScheduler();
    
    createMainWindow();
    createQuickAddWindow();
    createTray();
    
    registerGlobalHotkeys();
    registerIpcHandlers();
    
    // Verificar si se abrió con argumentos de protocolo en primer arranque
    const protocolArg = process.argv.find(arg => arg.startsWith('cybergo://'));
    if (protocolArg) {
      handleProtocolUrl(protocolArg);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      else restoreWindow();
    });
  });

  app.on('will-quit', () => {
    stopAlarmScheduler();
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (!tray) app.quit();
    }
  });
}
