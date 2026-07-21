// Formatting + validation helpers for the customer app.
import type { BookingStatus } from '../../shared/types';

/** Registration number: uppercase, keep letters/digits/spaces only. */
export function formatReg(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s{2,}/g, ' ');
}

/** Phone input sanitiser: digits only, max 10 (Indian mobile). */
export function formatPhoneInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, 10);
}

export function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

/** Today's date as YYYY-MM-DD in the local timezone (for <input type=date min>). */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export interface StatusMeta {
  label: string;
  /** Tailwind text colour class for chips/dots. */
  tone: string;
  /** Tailwind background tint for chip pills. */
  chip: string;
}

const STATUS_META: Record<BookingStatus, StatusMeta> = {
  requested: { label: 'Requested', tone: 'text-pinstripe-cyan', chip: 'bg-pinstripe-cyan/10 text-pinstripe-cyan border-pinstripe-cyan/30' },
  confirmed: { label: 'Confirmed', tone: 'text-goldBright', chip: 'bg-gold/10 text-goldBright border-gold/40' },
  in_progress: { label: 'In progress', tone: 'text-pinstripe-emerald', chip: 'bg-pinstripe-emerald/10 text-pinstripe-emerald border-pinstripe-emerald/30' },
  ready: { label: 'Ready for pickup', tone: 'text-pinstripe-emerald', chip: 'bg-pinstripe-emerald/10 text-pinstripe-emerald border-pinstripe-emerald/30' },
  delivered: { label: 'Delivered', tone: 'text-white', chip: 'bg-white/10 text-white border-white/25' },
  cancelled: { label: 'Cancelled', tone: 'text-pinstripe-red', chip: 'bg-pinstripe-red/10 text-pinstripe-red border-pinstripe-red/30' },
};

export function statusMeta(status: BookingStatus): StatusMeta {
  return STATUS_META[status];
}

/** The forward progress steps a booking moves through (cancelled is handled separately). */
export const TIMELINE_STEPS: BookingStatus[] = ['requested', 'confirmed', 'in_progress', 'ready', 'delivered'];
