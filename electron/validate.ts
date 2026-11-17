import type { AuthMethod, DisplayBounds, ItemDraft, PublicSettings, ReminderPosition } from '@shared/types';

/**
 * Every value that crosses the IPC boundary is checked here. A malformed
 * payload used to reach the scheduler and throw inside the handler, which
 * surfaced to the user as a silent no-op.
 *
 * The checks live in their own file, away from the Electron process, so they
 * can be tested without a window.
 */
export function asId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  // Control characters are refused, everything else is accepted: the value
  // travels to the database as a bound parameter, and narrowing it further
  // used to drop a group or turn an edit into a duplicate.
  if (/[\u0000-\u001f]/.test(trimmed)) return null;
  return trimmed;
}

export function asText(value: unknown, max = 4096): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > max) return null;
  return value;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return null;
  return stamp.toISOString();
}

export function methodOf(value: unknown): AuthMethod {
  return value === 'pin' ? 'pin' : 'password';
}

/** The secret as the user typed it, trimmed when it is a number. */
export function presented(value: unknown, method: AuthMethod): string {
  const raw = typeof value === 'string' ? value : '';
  return method === 'pin' ? raw.trim() : raw;
}

const SETTINGS_THEMES = ['cybergo', 'gray', 'light'];
const SETTINGS_LANGS = ['es', 'en'];
const SETTINGS_LOCK_LEVELS = ['visible', 'soft', 'hard'];
const SETTINGS_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

/**
 * The patch of settings:pick is the one mutating payload that used to be
 * written as it arrived, and a malformed value would be persisted forever
 * and read back with surprising fallbacks. A field that fails its check is
 * dropped from the patch, never guessed; a payload that is not an object is
 * refused whole.
 */
export function asSettingsPatch(value: unknown): Partial<PublicSettings> | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const out: Partial<PublicSettings> = {};
  if (raw.theme != null && SETTINGS_THEMES.includes(raw.theme as string)) out.theme = raw.theme as PublicSettings['theme'];
  if (raw.language != null && SETTINGS_LANGS.includes(raw.language as string)) out.language = raw.language as PublicSettings['language'];
  if (typeof raw.soundEnabled === 'boolean') out.soundEnabled = raw.soundEnabled;
  if (raw.soundPath != null) {
    const soundPath = asText(raw.soundPath, 4096);
    if (soundPath != null) out.soundPath = soundPath;
  }
  if (raw.lockLevel != null && SETTINGS_LOCK_LEVELS.includes(raw.lockLevel as string)) out.lockLevel = raw.lockLevel as PublicSettings['lockLevel'];
  if (typeof raw.lockOnLaunch === 'boolean') out.lockOnLaunch = raw.lockOnLaunch;
  if (typeof raw.autobackup === 'boolean') out.autobackup = raw.autobackup;
  if (raw.autobackupKeep != null) {
    const keep = asNumber(raw.autobackupKeep);
    if (keep != null && Number.isInteger(keep) && keep >= 1 && keep <= 60) out.autobackupKeep = keep;
  }
  if (typeof raw.openAtLogin === 'boolean') out.openAtLogin = raw.openAtLogin;
  if (typeof raw.reminderAlwaysOnTop === 'boolean') out.reminderAlwaysOnTop = raw.reminderAlwaysOnTop;
  if (raw.reminderDisplayId != null) {
    const displayId = asNumber(raw.reminderDisplayId);
    if (displayId != null && Number.isInteger(displayId)) out.reminderDisplayId = displayId;
  }
  if (raw.reminderDisplayBounds !== undefined) {
    // Missing stays out of the patch, null resets the remembered bounds.
    if (raw.reminderDisplayBounds == null) {
      out.reminderDisplayBounds = null;
    } else {
      const bounds = raw.reminderDisplayBounds as Record<string, unknown>;
      const x = asNumber(bounds.x);
      const y = asNumber(bounds.y);
      const width = asNumber(bounds.width);
      const height = asNumber(bounds.height);
      if (x != null && y != null && width != null && height != null) {
        out.reminderDisplayBounds = { x, y, width, height } satisfies DisplayBounds;
      }
    }
  }
  if (raw.reminderPosition != null && SETTINGS_POSITIONS.includes(raw.reminderPosition as string)) out.reminderPosition = raw.reminderPosition as ReminderPosition;
  if (raw.passwordHint != null) {
    // The same ceiling the auth channel applies to the hint.
    const hint = asText(raw.passwordHint, 200);
    if (hint != null) out.passwordHint = hint;
  }
  if (typeof raw.accessLogEnabled === 'boolean') out.accessLogEnabled = raw.accessLogEnabled;
  return out;
}

export function asDraft(value: unknown): ItemDraft | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = asText(raw.title, 2000);
  if (title == null) return null;
  // A field that is too long is refused, never shortened: shortening the
  // notes used to erase them without telling anybody.
  const notes = raw.notes == null ? '' : asText(raw.notes, 200000);
  if (notes == null) return null;
  const startLocal = raw.startLocal == null ? null : asText(raw.startLocal, 64);
  const endLocal = raw.endLocal == null ? null : asText(raw.endLocal, 64);
  if (raw.startLocal != null && startLocal == null) return null;
  if (raw.endLocal != null && endLocal == null) return null;
  const recurrence = raw.recurrence == null ? null : raw.recurrence as ItemDraft['recurrence'];
  if (recurrence) {
    if (typeof recurrence !== 'object') return null;
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(recurrence.freq)) return null;
  }
  // An id that is refused is an error, not a new item. Turning it into
  // undefined used to duplicate the record instead of reporting it.
  let id: string | undefined;
  if (raw.id != null) {
    const parsed = asId(raw.id);
    if (!parsed) return null;
    id = parsed;
  }
  return {
    id,
    kind: raw.kind === 'event' ? 'event' : 'task',
    title,
    notes,
    allDay: raw.allDay === true,
    startLocal,
    endLocal,
    importance: raw.importance === 'high' || raw.importance === 'low' ? raw.importance : 'normal',
    color: asText(raw.color, 32) ?? '',
    groupId: raw.groupId == null ? null : asId(raw.groupId),
    recurrence: recurrence
      ? {
        freq: recurrence.freq,
        interval: Math.max(1, Math.floor(Number(recurrence.interval) || 1)),
        until: recurrence.until == null ? null : asText(recurrence.until, 10),
        dayOfMonth: recurrence.dayOfMonth == null ? null : Number(recurrence.dayOfMonth),
      }
      : null,
    remindMinutes: Math.max(0, Math.floor(Number(raw.remindMinutes) || 0)),
  };
}
