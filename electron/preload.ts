import { contextBridge, ipcRenderer } from 'electron';
import { Task, AppSettings } from '../src/types';

contextBridge.exposeInMainWorld('cyberGoAPI', {
  // Window Management
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window-maximize-toggle'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  
  // App States
  isQuickAddWindow: () => ipcRenderer.invoke('app:is-quick-add'),
  closeQuickAddWindow: () => ipcRenderer.invoke('app:close-quick-add'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  setAutoStart: (enable: boolean) => ipcRenderer.invoke('settings:set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('settings:get-auto-start'),
  
  // Tasks CRUD
  getTasks: () => ipcRenderer.invoke('tasks:get-all'),
  saveTask: (task: Task) => ipcRenderer.invoke('tasks:save', task),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  
  // Data Import/Export & Backup
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  getBackups: () => ipcRenderer.invoke('data:get-backups'),
  restoreBackup: (name: string) => ipcRenderer.invoke('data:restore-backup', name),
  createBackup: () => ipcRenderer.invoke('data:create-backup'),
  
  // Listeners
  onTaskTriggered: (callback: (task: Task) => void) => {
    const listener = (_e: any, task: Task) => callback(task);
    ipcRenderer.on('task-triggered', listener);
    return () => ipcRenderer.removeListener('task-triggered', listener);
  },
  onQuickAddOpen: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('quick-add-open', listener);
    return () => ipcRenderer.removeListener('quick-add-open', listener);
  },
  onSettingChanged: (callback: (data: { key: keyof AppSettings, value: any }) => void) => {
    const listener = (_e: any, data: any) => callback(data);
    ipcRenderer.on('setting-changed', listener);
    return () => ipcRenderer.removeListener('setting-changed', listener);
  },
  onTaskUpdatedExternal: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('task-updated-external', listener);
    return () => ipcRenderer.removeListener('task-updated-external', listener);
  },
  onFocusTask: (callback: (taskId: string) => void) => {
    const listener = (_e: any, taskId: string) => callback(taskId);
    ipcRenderer.on('focus-task', listener);
    return () => ipcRenderer.removeListener('focus-task', listener);
  }
});
