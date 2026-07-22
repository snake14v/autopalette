// Repeat-customer prefill (WAVE5_SPEC section E.4) — local-only, no account, no server read.
// After a successful booking we remember name/phone/vehicles on THIS device so the next visit
// to the book flow can prefill the form with an editable "Booking as <name> · <reg> — change"
// banner. Never sent anywhere; a customer clearing site data loses it, which is fine (it's a
// convenience prefill, not a record of truth).
import type { Booking } from '../../shared/types';

const KEY = 'ap:customer-profile';

export interface ProfileVehicle {
  regNumber: string;
  makeModel: string;
}

export interface CustomerProfile {
  name: string;
  phone: string;
  /** Most-recently-used vehicle first, deduped by registration number. */
  vehicles: ProfileVehicle[];
}

export function getProfile(): CustomerProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerProfile>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
    };
  } catch {
    return null;
  }
}

/** Called after a successful booking — upserts this device's remembered profile. */
export function saveProfileFromBooking(booking: Booking): void {
  const name = booking.customer.name.trim();
  const phone = booking.customer.phone.trim();
  if (!name && !phone) return;

  const existing = getProfile();
  const regNumber = booking.vehicle.regNumber.trim();
  const regUpper = regNumber.toUpperCase();
  const otherVehicles = (existing?.vehicles ?? []).filter((v) => v.regNumber.toUpperCase() !== regUpper);
  const vehicles: ProfileVehicle[] = regNumber
    ? [{ regNumber, makeModel: booking.vehicle.makeModel }, ...otherVehicles]
    : otherVehicles;

  const profile: CustomerProfile = {
    name: name || existing?.name || '',
    phone: phone || existing?.phone || '',
    vehicles,
  };

  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal, just no prefill next time */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
