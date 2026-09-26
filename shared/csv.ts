import { buildSchedule, parseLocal } from './schedule';
import type { Group, Item, ItemDraft, Kind, Importance, Freq } from './types';

export const CSV_HEADERS = [
  'kind',
  'title',
  'notes',
  'all_day',
  'start_at',
  'end_at',
  'importance',
  'color',
  'group',
  'recurrence_freq',
  'recurrence_interval',
  'recurrence_until',
  'remind_minutes',
] as const;

function esc(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: Record<string, string>[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => esc(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    table.push(row);
  }
  if (!table.length) return [];
  const header = table[0].map((h) => h.trim());
  return table.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}

function asKind(value: string, hasStart: boolean): Kind {
  const v = value.trim().toLowerCase();
  if (v === 'task' || v === 'tarea') return 'task';
  if (v === 'event' || v === 'evento') return 'event';
  return hasStart ? 'event' : 'task';
}

function asImportance(value: string): Importance {
  const v = value.trim().toLowerCase();
  if (v === 'high' || v === 'alta') return 'high';
  if (v === 'low' || v === 'baja') return 'low';
  return 'normal';
}

function asBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'si' || v === 'sí';
}

function asFreq(value: string): Freq | null {
  const v = value.trim().toLowerCase();
  if (v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'yearly') return v;
  return null;
}

export function itemToCsvRow(item: Item, groups: Group[]): Record<string, string> {
  const group = groups.find((g) => g.id === item.groupId);
  const start = item.allDay ? (item.startAt ? localDate(item.startAt) : '') : localStamp(item.startAt);
  const end = item.allDay ? (item.endAt ? localDate(item.endAt) : '') : localStamp(item.endAt);
  return {
    kind: item.kind,
    title: item.title,
    notes: item.notes,
    all_day: item.allDay ? '1' : '0',
    start_at: start,
    end_at: end,
    importance: item.importance,
    color: item.color,
    group: group?.name ?? '',
    recurrence_freq: item.recurrence?.freq ?? '',
    recurrence_interval: item.recurrence ? String(item.recurrence.interval) : '',
    recurrence_until: item.recurrence?.until ?? '',
    remind_minutes: String(item.remindMinutes ?? 0),
  };
}

function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function localStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${localDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function rowToDraft(row: Record<string, string>, groups: Group[]): { draft: ItemDraft; newGroupName: string | null } {
  const title = (row.title || '').trim();
  if (!title) throw new Error('missing title');
  const startRaw = (row.start_at || '').trim();
  const endRaw = (row.end_at || '').trim();
  const allDay = asBool(row.all_day || '');
  const kind = asKind(row.kind || '', Boolean(startRaw));
  if (startRaw) parseLocal(startRaw, allDay || startRaw.length <= 10);
  if (endRaw) parseLocal(endRaw, allDay || endRaw.length <= 10);
  const freq = asFreq(row.recurrence_freq || '');
  const interval = Math.max(1, Number(row.recurrence_interval || '1') || 1);
  const until = (row.recurrence_until || '').trim();
  const groupName = (row.group || '').trim();
  const existing = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
  const remind = Math.max(0, Number(row.remind_minutes || '0') || 0);
  const draft: ItemDraft = {
    kind,
    title,
    notes: row.notes || '',
    allDay: allDay || (Boolean(startRaw) && startRaw.length <= 10),
    startLocal: startRaw ? startRaw.replace(' ', 'T') : null,
    endLocal: endRaw ? endRaw.replace(' ', 'T') : null,
    importance: asImportance(row.importance || ''),
    color: (row.color || '').trim(),
    groupId: existing?.id ?? null,
    recurrence: freq ? { freq, interval, until: until || null } : null,
    remindMinutes: remind,
  };
  if (draft.startLocal) buildSchedule(draft);
  return { draft, newGroupName: groupName && !existing ? groupName : null };
}
