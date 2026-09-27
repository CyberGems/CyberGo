export type Lang = 'es' | 'en';
export type ThemeId = 'cybergo' | 'gray' | 'light';
export type Kind = 'event' | 'task';
export type Importance = 'low' | 'normal' | 'high';
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type LockLevel = 'soft' | 'hard';
export type AuthMethod = 'password' | 'pin';
export type AccessLogEvent = 'success' | 'failure' | 'recovery-success' | 'recovery-failure' | 'blocked';
export type AccessLogMethod = AuthMethod | 'recovery';

export interface Recurrence {
  freq: Freq;
  interval: number;
  /** YYYY-MM-DD, inclusive. Null means no end. */
  until: string | null;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  notes: string;
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  importance: Importance;
  color: string;
  groupId: string | null;
  recurrence: Recurrence | null;
  remindMinutes: number;
  occurrenceAt: string | null;
  nextFireAt: string | null;
  snoozeUntil: string | null;
  /** fireKey already announced, or "dismissed" when this occurrence will not fire again. */
  alertKey: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  remoteId: string | null;
  syncRev: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemDraft {
  id?: string;
  kind: Kind;
  title: string;
  notes: string;
  allDay: boolean;
  /** YYYY-MM-DD or YYYY-MM-DDTHH:mm, local. */
  startLocal: string | null;
  endLocal: string | null;
  importance: Importance;
  color: string;
  groupId: string | null;
  recurrence: Recurrence | null;
  remindMinutes: number;
}

export interface PublicSettings {
  theme: ThemeId;
  language: Lang;
  soundEnabled: boolean;
  soundPath: string;
  lockLevel: LockLevel;
  lockOnLaunch: boolean;
  autobackup: boolean;
  autobackupKeep: number;
  openAtLogin: boolean;
  reminderAlwaysOnTop: boolean;
  passwordHint: string;
  /** How the lock secret is entered. The hash itself stays out of this object. */
  authMethod: AuthMethod;
  accessLogEnabled: boolean;
}

export interface Bootstrap {
  items: Item[];
  groups: Group[];
  settings: PublicSettings;
  locked: boolean;
  hasPassword: boolean;
}

export interface BackupInfo {
  name: string;
  createdAt: string;
  bytes: number;
}

export interface AccessLogEntry {
  id: number;
  occurredAt: string;
  event: AccessLogEvent;
  method: AccessLogMethod;
}

export interface CsvResult {
  added: number;
  errors: string[];
}

export const SWATCHES = [
  '#6c63e6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#3b82f6',
  '#d946ef',
];
