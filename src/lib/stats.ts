export interface DayStats {
  /** Consecutive days with at least one completion, ending today or yesterday. */
  streak: number;
  doneToday: number;
  doneWeek: number;
}

function localKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Counts completions per local day from a list of completedAt ISO strings. */
export function computeStats(completedAt: (string | null)[]): DayStats {
  const perDay = new Map<string, number>();
  for (const iso of completedAt) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const key = localKey(d);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const today = startOfToday();
  const doneToday = perDay.get(localKey(today)) ?? 0;
  let doneWeek = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    doneWeek += perDay.get(localKey(day)) ?? 0;
  }
  let streak = 0;
  const cursor = new Date(today);
  if (!perDay.has(localKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (perDay.has(localKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, doneToday, doneWeek };
}
