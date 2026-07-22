// docs/WAVE5_SPEC.md section D — per-jobcard progress. Derived, never stored: confirmed +
// finished work items ÷ total work items linked to that jobcard. Zero work items -> null, so
// every call site renders no bar at all rather than a fake 0%.

import type { Jobcard, WorkItem } from '../../shared/types';

export interface JobcardProgress {
  done: number;
  total: number;
}

/** Work items counting as "done" toward a jobcard's progress bar. */
const DONE_STATUSES = new Set(['finished', 'confirmed']);

export function jobcardProgress(jobcardId: string, workItems: WorkItem[]): JobcardProgress | null {
  const items = workItems.filter((w) => w.jobcardId === jobcardId);
  if (items.length === 0) return null;
  const done = items.filter((w) => DONE_STATUSES.has(w.status)).length;
  return { done, total: items.length };
}

/** Same computation, keyed by jobcard — handy for list/kanban views iterating many cards. */
export function jobcardProgressByJobcard(
  jobcards: Pick<Jobcard, 'id'>[],
  workItems: WorkItem[]
): Map<string, JobcardProgress> {
  const byJobcard = new Map<string, WorkItem[]>();
  for (const w of workItems) {
    if (!w.jobcardId) continue;
    const list = byJobcard.get(w.jobcardId) ?? [];
    list.push(w);
    byJobcard.set(w.jobcardId, list);
  }
  const result = new Map<string, JobcardProgress>();
  for (const jc of jobcards) {
    const items = byJobcard.get(jc.id);
    if (!items || items.length === 0) continue;
    const done = items.filter((w) => DONE_STATUSES.has(w.status)).length;
    result.set(jc.id, { done, total: items.length });
  }
  return result;
}
