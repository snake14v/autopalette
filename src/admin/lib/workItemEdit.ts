// ---------------------------------------------------------------------------------------
// FLAGGED WORKAROUND — reassign / edit a work item's title, estHours, date or assignee.
//
// The frozen DataDriver surface (src/shared/data.ts) exposes createWorkItem,
// updateWorkItemStatus, confirmWorkItem, adjustWorkItemHours and addWorkNote — but NO
// generic "update this work item's fields / reassign it" method. Day Board's spec
// ("Reassign/edit items") needs one.
//
// Since the running app is in DEMO mode (no Firebase config), the localDriver persists work
// items to localStorage under 'ap:work-items' as Record<id, WorkItem> and broadcasts an
// in-tab 'ap:local-store-changed' event. We patch that same store here so demo-mode edit /
// reassign is fully functional and live-updating through the existing subscriptions.
//
// In LIVE (Firestore) mode this is unavailable — canEditWorkItem() returns false and the UI
// hides the edit/reassign controls with a note. The proper fix is a driver method, e.g.
//   updateWorkItem(id, patch: Partial<Pick<WorkItem,'title'|'assignedTo'|'estHours'|'date'>>)
// added to DataDriver + both drivers. See build report "shared gaps".
// ---------------------------------------------------------------------------------------

import type { WorkItem } from '../../shared/types';
import { isDemo } from './useDriver';

const WORK_ITEMS_KEY = 'ap:work-items';

export type WorkItemEdit = Partial<Pick<WorkItem, 'title' | 'assignedTo' | 'estHours' | 'date'>>;

/** True when in-place edit / reassign is available (demo mode only, per the note above). */
export function canEditWorkItem(): boolean {
  return isDemo;
}

/**
 * Patch a work item's editable fields (demo mode). No-ops (returns false) in live mode or if
 * the item is missing. Mirrors localDriver's write path so subscribers refresh immediately.
 */
export function editWorkItemLocal(id: string, patch: WorkItemEdit): boolean {
  if (!isDemo) return false;
  let store: Record<string, WorkItem>;
  try {
    const raw = localStorage.getItem(WORK_ITEMS_KEY);
    store = raw ? (JSON.parse(raw) as Record<string, WorkItem>) : {};
  } catch {
    return false;
  }
  const item = store[id];
  if (!item) return false;
  const next: WorkItem = { ...item };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.assignedTo !== undefined) next.assignedTo = patch.assignedTo;
  if (patch.estHours !== undefined) next.estHours = patch.estHours;
  if (patch.date !== undefined) next.date = patch.date;
  store[id] = next;
  localStorage.setItem(WORK_ITEMS_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: WORK_ITEMS_KEY } }));
  return true;
}
