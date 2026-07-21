// Wave 3 — WhatsApp review-and-send deep links, built from the CUSTOMER's phone. These NEVER
// send automatically: they produce a wa.me href that opens WhatsApp with prefilled text for the
// admin to review and send by hand (house contact policy: phones + WhatsApp only, human-sent).
// Studio-number links stay in shared/format.ts::whatsappLink; these target the customer.

import type { Booking, Jobcard } from '../../shared/types';
import { normalizePhone } from '../../shared/data';
import { BOOKING_STATUS_LABEL } from './status';
import { inr } from './format';

/**
 * wa.me/91XXXXXXXXXX deep link to the customer, or null when the phone isn't a usable
 * 10-digit Indian mobile (caller hides the affordance rather than build a broken link).
 */
export function customerWhatsappLink(phone: string, text: string): string | null {
  const local = normalizePhone(phone);
  if (local.length !== 10) return null;
  return `https://wa.me/91${local}?text=${encodeURIComponent(text)}`;
}

/** Short status-update message: greeting, vehicle reg, new status, Autopalette sign-off. */
export function statusNotifyText(b: Booking): string {
  const name = b.customer.name?.trim();
  const reg = b.vehicle.regNumber?.trim() || 'your vehicle';
  const greeting = name ? `Hi ${name}, ` : 'Hi, ';
  return `${greeting}update on ${reg}: status is now "${BOOKING_STATUS_LABEL[b.status]}". — Autopalette`;
}

/** Payment nudge: invoice number, total, balance due, Autopalette sign-off. */
export function paymentNudgeText(jc: Jobcard): string {
  const name = jc.customer.name?.trim();
  const reg = jc.vehicle.regNumber?.trim();
  const greeting = name ? `Hi ${name}, ` : 'Hi, ';
  const invoice = jc.invoiceNumber ? `Invoice ${jc.invoiceNumber}` : 'Your invoice';
  const regPart = reg ? ` (${reg})` : '';
  return `${greeting}${invoice}${regPart} is ready — total ${inr(jc.pricing.totalAmount)}, balance due ${inr(jc.pricing.balanceDue)}. — Autopalette`;
}
