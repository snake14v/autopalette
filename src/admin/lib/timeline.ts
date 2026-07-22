// docs/WAVE5_SPEC.md section B — jobcard activity timeline: merges statusHistory + linked
// work-item events (created/started/finished/confirmed) + paymentHistory into one
// chronological list for the jobcard editor. Pure — the caller supplies the work items
// already filtered/subscribed elsewhere (JobcardEditor already has useWorkItems()).

import type { Jobcard, JobcardStatus, WorkItem } from '../../shared/types';
import { JOBCARD_STATUS_LABEL, PAYMENT_STATUS_LABEL } from './status';

export type TimelineKind = 'status' | 'payment' | 'workitem';

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  status: 'Status',
  payment: 'Payment',
  workitem: 'Work item',
};

export interface TimelineEvent {
  key: string;
  at: number;
  kind: TimelineKind;
  label: string;
  detail?: string;
  /** Present for work-item events — the assigned employee, for the colour dot. */
  employeeId?: string;
}

const WORKITEM_EVENT_LABEL: Record<'assigned' | 'started' | 'finished' | 'confirmed', string> = {
  assigned: 'assigned',
  started: 'started',
  finished: 'finished',
  confirmed: 'confirmed',
};

/** Builds the merged, chronologically-sorted timeline for one jobcard. */
export function buildJobcardTimeline(jc: Jobcard, workItems: WorkItem[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const h of jc.statusHistory) {
    events.push({
      key: `status-${h.at}-${h.status}`,
      at: h.at,
      kind: 'status',
      label: `Status → ${JOBCARD_STATUS_LABEL[h.status as JobcardStatus] ?? h.status}`,
      detail: h.reason ? `“${h.reason}”` : h.by,
    });
  }

  for (const p of jc.paymentHistory ?? []) {
    events.push({
      key: `payment-${p.at}`,
      at: p.at,
      kind: 'payment',
      label: `Payment → ${PAYMENT_STATUS_LABEL[p.to]}`,
      detail: `from ${PAYMENT_STATUS_LABEL[p.from]}`,
    });
  }

  const linked = workItems.filter((w) => w.jobcardId === jc.id);
  for (const w of linked) {
    const push = (at: number | undefined, evt: keyof typeof WORKITEM_EVENT_LABEL) => {
      if (!at) return;
      events.push({
        key: `wi-${evt}-${w.id}`,
        at,
        kind: 'workitem',
        label: `${w.title} — ${WORKITEM_EVENT_LABEL[evt]}`,
        employeeId: w.assignedTo,
      });
    };
    push(w.createdAt, 'assigned');
    push(w.startedAt, 'started');
    push(w.finishedAt, 'finished');
    push(w.confirmedAt, 'confirmed');
  }

  return events.sort((a, b) => a.at - b.at);
}
