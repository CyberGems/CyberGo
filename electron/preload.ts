import { contextBridge, ipcRenderer } from 'electron';
import type { AccessLogEntry, AuthMethod, Bootstrap, CsvResult, Group, Item, ItemDraft, PublicSettings } from '../shared/types';

export interface CyberGoAPI {
  getBootstrap: () => Promise<Bootstrap>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  saveItem: (draft: ItemDraft) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  purgeItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  completeItem: (id: string) => Promise<void>;
  saveGroup: (input: { id?: string; name: string; color: string }) => Promise<Group>;
  deleteGroup: (id: string) => Promise<void>;
  patchSettings: (patch: Partial<PublicSettings>) => Promise<PublicSettings>;
  listAccessLog: () => Promise<AccessLogEntry[]>;
  clearAccessLog: () => Promise<void>;
  setPassword: (password: string, hint: string, method: AuthMethod) => Promise<{ ok: true; recoveryCode: string } | { ok: false; error: string }>;
  changePassword: (current: string, next: string, hint: string, method: AuthMethod) => Promise<{ ok: true; recoveryCode: string } | { ok: false; error: string }>;
  removePassword: (current: string) => Promise<boolean>;
  unlock: (password: string) => Promise<'ok' | 'wrong' | 'wait'>;
  recover: (code: string, next: string, method: AuthMethod) => Promise<{ ok: true; recoveryCode: string } | { ok: false; error: string }>;
  lock: () => Promise<boolean>;
  dueReminders: () => Promise<Item[]>;
  showReminders: () => Promise<void>;
  snooze: (id: string, minutes: number) => Promise<void>;
  snoozeTomorrow: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  openItem: (id: string) => Promise<void>;
  soundPath: () => Promise<string>;
  pickSound: () => Promise<string | null>;
  clearSound: () => Promise<void>;
  backupNow: () => Promise<string>;
  listBackups: () => Promise<{ name: string; createdAt: string; bytes: number }[]>;
  restoreBackup: (name: string) => Promise<boolean>;
  openDataFolder: () => Promise<string>;
  exportCsv: () => Promise<boolean>;
  importCsv: () => Promise<CsvResult | null>;
  importIcs: () => Promise<CsvResult | null>;
  onDataChanged: (cb: () => void) => () => void;
  onQuickAddFocus: (cb: () => void) => () => void;
  onReminderUpdate: (cb: (payload: { sound: boolean; pulseIds: string[] }) => void) => () => void;
  onOpenItem: (cb: (id: string) => void) => () => void;
  onMaximized: (cb: (value: boolean) => void) => () => void;
}

const api: CyberGoAPI = {
  getBootstrap: () => ipcRenderer.invoke('bootstrap:get'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  saveItem: (draft) => ipcRenderer.invoke('items:save', draft),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),
  restoreItem: (id) => ipcRenderer.invoke('items:restore', id),
  purgeItem: (id) => ipcRenderer.invoke('items:purge', id),
  emptyTrash: () => ipcRenderer.invoke('items:empty-trash'),
  completeItem: (id) => ipcRenderer.invoke('items:complete', id),
  saveGroup: (input) => ipcRenderer.invoke('groups:save', input),
  deleteGroup: (id) => ipcRenderer.invoke('groups:delete', id),
  patchSettings: (patch) => ipcRenderer.invoke('settings:patch', patch),
  listAccessLog: () => ipcRenderer.invoke('access-log:list'),
  clearAccessLog: () => ipcRenderer.invoke('access-log:clear'),
  setPassword: (password, hint, method) => ipcRenderer.invoke('auth:set', password, hint, method),
  changePassword: (current, next, hint, method) => ipcRenderer.invoke('auth:change', current, next, hint, method),
  removePassword: (current) => ipcRenderer.invoke('auth:remove', current),
  unlock: (password) => ipcRenderer.invoke('auth:unlock', password),
  recover: (code, next, method) => ipcRenderer.invoke('auth:recover', code, next, method),
  lock: () => ipcRenderer.invoke('auth:lock'),
  dueReminders: () => ipcRenderer.invoke('reminders:due'),
  showReminders: () => ipcRenderer.invoke('reminders:show'),
  snooze: (id, minutes) => ipcRenderer.invoke('reminders:snooze', id, minutes),
  snoozeTomorrow: (id) => ipcRenderer.invoke('reminders:tomorrow', id),
  dismiss: (id) => ipcRenderer.invoke('reminders:dismiss', id),
  dismissAll: () => ipcRenderer.invoke('reminders:dismiss-all'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('reminders:always-on-top', value),
  openItem: (id) => ipcRenderer.invoke('reminders:open-item', id),
  soundPath: () => ipcRenderer.invoke('sound:path'),
  pickSound: () => ipcRenderer.invoke('sound:pick'),
  clearSound: () => ipcRenderer.invoke('sound:clear'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (name) => ipcRenderer.invoke('backup:restore', name),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  exportCsv: () => ipcRenderer.invoke('csv:export'),
  importCsv: () => ipcRenderer.invoke('csv:import'),
  importIcs: () => ipcRenderer.invoke('ics:import'),
  onDataChanged: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('data:changed', listener);
    return () => ipcRenderer.removeListener('data:changed', listener);
  },
  onReminderUpdate: (cb) => {
    const listener = (_e: unknown, payload: { sound: boolean; pulseIds: string[] }) => cb(payload);
    ipcRenderer.on('reminder:update', listener);
    return () => ipcRenderer.removeListener('reminder:update', listener);
  },
  onOpenItem: (cb) => {
    const listener = (_e: unknown, id: string) => cb(id);
    ipcRenderer.on('open-item', listener);
    return () => ipcRenderer.removeListener('open-item', listener);
  },
  onQuickAddFocus: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('quick-add:focus', listener);
    return () => ipcRenderer.removeListener('quick-add:focus', listener);
  },
  onMaximized: (cb) => {
    const listener = (_e: unknown, value: boolean) => cb(value);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
};

contextBridge.exposeInMainWorld('cyberGoAPI', api);
