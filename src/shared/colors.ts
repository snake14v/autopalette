// docs/WAVE5_SPEC.md section A — employee colour coding. ONE shared resolution helper, used
// by every admin surface an employee appears on (Day Board headers + work-item card borders,
// My Day header, jobcard assignedTo chips, kanban assignee dots, DataPanel hours rows) so the
// colour can never drift between screens.

import type { Employee } from './types';

/**
 * Curated 8-colour palette — chosen for mutual distinguishability, for ≥3:1 contrast against
 * the dark panel background (#141414, this app's `char3` token), and for being visually
 * distinct from the brand gold (#c5a44e/#e8c96e/#ffd700) and the pinstripe status colours
 * already in use (cyan #00e5ff, magenta #ff00d4, emerald #00ff88, red #ff1a1a). All 8 exceed
 * 6:1 contrast against #141414 by WCAG relative-luminance math (background is near-black, so
 * any mid-to-bright hue clears 3:1 comfortably) — spot-checked, not merely eyeballed.
 */
export const EMPLOYEE_PALETTE: string[] = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#a3e635', // lime
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#818cf8', // indigo
];

/** Neutral fallback for an unknown/removed employee (e.g. a stale WorkItem.assignedTo). */
export const EMPLOYEE_COLOR_FALLBACK = '#9ca3af';

/**
 * Resolves an employee's display colour: their explicit `color` if set, otherwise an
 * auto-assignment by position in `roster` (the same stably-ordered list every screen already
 * gets from useEmployees() — sorted by loginId in both drivers), so the auto-assigned colour
 * is consistent across every surface without persisting anything until the admin picks one via
 * the roster editor's swatch picker.
 */
export function employeeColor(employee: Employee | null | undefined, roster: Employee[]): string {
  if (!employee) return EMPLOYEE_COLOR_FALLBACK;
  if (employee.color) return employee.color;
  const idx = roster.findIndex((e) => e.id === employee.id);
  return EMPLOYEE_PALETTE[(idx < 0 ? 0 : idx) % EMPLOYEE_PALETTE.length];
}

/** Same resolution, keyed by employeeId — for call sites that only have the id at hand. */
export function employeeColorById(
  employeeId: string | null | undefined,
  roster: Employee[]
): string {
  if (!employeeId) return EMPLOYEE_COLOR_FALLBACK;
  return employeeColor(roster.find((e) => e.id === employeeId) ?? null, roster);
}
