// Date helpers for the Wave-2 work-tracking screens. All work with local time (IST for the
// studio) — NOT UTC — so "today" on the Day Board matches the operator's wall clock. The
// WorkItem.date field is a plain 'YYYY-MM-DD' string keyed in local time.

/** Local 'YYYY-MM-DD' for a Date (defaults to now). Local time, never UTC. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today, local time, as 'YYYY-MM-DD'. */
export function todayISO(): string {
  return toISODate();
}

/** Add (or subtract) whole days to a 'YYYY-MM-DD' string, returning a new 'YYYY-MM-DD'. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** true when the ISO date is strictly before today (used for the staff "overdue backlog"). */
export function isBeforeToday(iso: string): boolean {
  return iso < todayISO();
}

/**
 * ISO-8601 week key ('YYYY-Www') for a 'YYYY-MM-DD' date — Monday-based, matching how the
 * studio thinks of a work week. Used to bucket logged hours "per week".
 */
export function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  // Shift to the Thursday of this week so the year is the ISO week-numbering year.
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday…Sunday range (inclusive ISO dates) for the week containing `iso`. */
export function weekRange(iso: string): { start: string; end: string } {
  const d = new Date(`${iso}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Mon=0
  const monday = addDays(iso, -day);
  return { start: monday, end: addDays(monday, 6) };
}

/** True if two ISO dates fall in the same Monday-based week. */
export function isSameWeek(a: string, b: string): boolean {
  return weekKey(a) === weekKey(b);
}

/** 'YYYY-MM' month key for a 'YYYY-MM-DD' date. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Human 'Jul 2026' for a 'YYYY-MM' key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** 'YYYY-MM' for the current local month, and for `n` months back. */
export function thisMonthKey(): string {
  return todayISO().slice(0, 7);
}
export function monthKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Round hours to 2dp for display. */
export function fmtHours(h: number): string {
  const n = Number.isFinite(h) ? h : 0;
  return `${Math.round(n * 100) / 100}h`;
}
