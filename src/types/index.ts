export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  priority: 1 | 2 | 3 | 4; // 1 = Urgent/Important, 2 = Important/Not Urgent, 3 = Urgent/Not Important, 4 = Not Urgent/Not Important
  notes?: string;
  createdAt: string;
  dueDate?: string; // ISO string
  completed: boolean;
  completedAt?: string;
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday...
    interval?: number; // Every X days/weeks
  };
  reminderTriggered?: boolean;
  preAlarmSent?: boolean;
  subtasks?: Subtask[];
  blockedBy?: string[]; // IDs de tareas que bloquean esta tarea
}

export interface SmartList {
  id: string;
  name: string;
  filter: 'all' | 'today' | 'week' | 'overdue' | 'no-date';
  category: string;
  searchQuery: string;
}

export interface AppSettings {
  language: 'es' | 'en';
  theme: 'sapphire' | 'amber' | 'pink' | 'emerald';
  globalHotkey: string;
  autoStart: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  pomodoroWorkTime: number; // in minutes
  pomodoroBreakTime: number;
  smartLists: SmartList[];
}

export interface BackupInfo {
  name: string;
  timestamp: number;
  size: number;
}

export interface CyberGoAPI {
  // Window Management
  windowMinimize: () => Promise<void>;
  windowMaximizeToggle: () => Promise<void>;
  windowClose: () => Promise<void>;
  openDevTools: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  
  // App States
  isQuickAddWindow: () => Promise<boolean>;
  closeQuickAddWindow: () => Promise<void>;
  
  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  setAutoStart: (enable: boolean) => Promise<boolean>;
  getAutoStart: () => Promise<boolean>;
  
  // Tasks CRUD
  getTasks: () => Promise<Task[]>;
  saveTask: (task: Task) => Promise<Task>;
  deleteTask: (id: string) => Promise<boolean>;
  
  // Data Import/Export & Backup
  exportData: () => Promise<boolean>;
  importData: () => Promise<boolean>;
  getBackups: () => Promise<BackupInfo[]>;
  restoreBackup: (name: string) => Promise<boolean>;
  createBackup: () => Promise<boolean>;
  
  // Listeners
  onTaskTriggered: (callback: (task: Task) => void) => () => void;
  onQuickAddOpen: (callback: () => void) => () => void;
  onSettingChanged: (callback: (data: { key: keyof AppSettings, value: any }) => void) => () => void;
  onTaskUpdatedExternal: (callback: () => void) => () => void;
  onFocusTask: (callback: (taskId: string) => void) => () => void;
}

declare global {
  interface Window {
    cyberGoAPI: CyberGoAPI;
  }
}
