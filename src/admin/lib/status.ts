// Status vocabulary + presentation metadata, shared across admin screens.

import type { BookingStatus, JobcardStatus, WorkItemStatus } from '../../shared/types';
import { JOBCARD_FLOW } from '../../shared/data';

/** The linear booking flow (cancelled is a side branch, not part of the ladder). */
export const BOOKING_FLOW: BookingStatus[] = [
  'requested',
  'confirmed',
  'in_progress',
  'ready',
  'delivered',
];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Tailwind class fragments (text / border / soft bg) keyed by status, on the brand palette.
export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  requested: 'text-goldBright border-gold/40 bg-gold/10',
  confirmed: 'text-pinstripe-cyan border-pinstripe-cyan/40 bg-pinstripe-cyan/10',
  in_progress: 'text-neonGold border-neonGold/40 bg-neonGold/10',
  ready: 'text-pinstripe-emerald border-pinstripe-emerald/40 bg-pinstripe-emerald/10',
  delivered: 'text-pinstripe-emerald border-pinstripe-emerald/50 bg-pinstripe-emerald/15',
  cancelled: 'text-pinstripe-red border-pinstripe-red/40 bg-pinstripe-red/10',
};

/** Next status in the linear flow, or null if terminal / cancelled. */
export function nextBookingStatus(current: BookingStatus): BookingStatus | null {
  if (current === 'cancelled') return null;
  const i = BOOKING_FLOW.indexOf(current);
  if (i === -1 || i >= BOOKING_FLOW.length - 1) return null;
  return BOOKING_FLOW[i + 1];
}

// --- payment status ---------------------------------------------------------------------

export type PaymentStatus = 'unpaid' | 'advance_paid' | 'paid';

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  advance_paid: 'Advance Paid',
  paid: 'Paid',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  unpaid: 'text-pinstripe-red border-pinstripe-red/40 bg-pinstripe-red/10',
  advance_paid: 'text-pinstripe-cyan border-pinstripe-cyan/40 bg-pinstripe-cyan/10',
  paid: 'text-pinstripe-emerald border-pinstripe-emerald/40 bg-pinstripe-emerald/10',
};

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  '': '—',
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

// --- job-card lifecycle status (docs/JOBCARD_LIFECYCLE_SPEC.md) -------------------------
// JOBCARD_FLOW (the forward ladder) lives in src/shared/data.ts — single source of truth,
// re-exported here so admin screens can import status vocabulary from one place.
export { JOBCARD_FLOW };

export const JOBCARD_STATUS_LABEL: Record<JobcardStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  quality_check: 'Quality Check',
  completed: 'Completed',
  closed: 'Closed',
  void: 'Void',
};

export const JOBCARD_STATUS_TONE: Record<JobcardStatus, string> = {
  open: 'text-goldBright border-gold/40 bg-gold/10',
  in_progress: 'text-neonGold border-neonGold/40 bg-neonGold/10',
  quality_check: 'text-pinstripe-cyan border-pinstripe-cyan/40 bg-pinstripe-cyan/10',
  completed: 'text-pinstripe-emerald border-pinstripe-emerald/40 bg-pinstripe-emerald/10',
  closed: 'text-pinstripe-emerald border-pinstripe-emerald/50 bg-pinstripe-emerald/15',
  // Muted/grey — deliberately NOT the red used for Cancel elsewhere (owner directive: void
  // is an internal record correction, not a customer-facing failure).
  void: 'text-white/55 border-white/25 bg-white/[0.06]',
};

/** The stage-aware quick-action label shown on kanban cards / the lifecycle strip. */
export const JOBCARD_NEXT_ACTION_LABEL: Partial<Record<JobcardStatus, string>> = {
  open: 'Start Work',
  in_progress: 'Send to QC',
  quality_check: 'Pass QC',
  completed: 'Deliver',
};

/** Next forward status in the lifecycle, or null when terminal (closed) or void. */
export function nextJobcardStatus(current: JobcardStatus): JobcardStatus | null {
  const i = JOBCARD_FLOW.indexOf(current);
  if (i === -1 || i >= JOBCARD_FLOW.length - 1) return null;
  return JOBCARD_FLOW[i + 1];
}

// --- work-item status (Wave 2 daily work tracking) --------------------------------------

/** The linear work-item flow (admin confirms the last hop). */
export const WORKITEM_FLOW: WorkItemStatus[] = ['assigned', 'in_progress', 'finished', 'confirmed'];

export const WORKITEM_STATUS_LABEL: Record<WorkItemStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  finished: 'Finished',
  confirmed: 'Confirmed',
};

export const WORKITEM_STATUS_TONE: Record<WorkItemStatus, string> = {
  assigned: 'text-white/70 border-white/25 bg-white/5',
  in_progress: 'text-neonGold border-neonGold/40 bg-neonGold/10',
  finished: 'text-pinstripe-cyan border-pinstripe-cyan/40 bg-pinstripe-cyan/10',
  confirmed: 'text-pinstripe-emerald border-pinstripe-emerald/45 bg-pinstripe-emerald/12',
};
