// Status vocabulary + presentation metadata, shared across admin screens.

import type { BookingStatus, WorkItemStatus } from '../../shared/types';

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
