// "My bookings" — the list of booking IDs saved on THIS device (localStorage).
// The booking ID is the only tracking capability (guest, no accounts), so we persist
// it here after a successful booking and read it back on Home / My bookings.
import { useEffect, useState } from 'react';

const KEY = 'ap:my-booking-ids';

export function getMyBookingIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('ap:my-bookings-changed'));
}

/** Save a booking id (most-recent-first, deduped). */
export function saveMyBookingId(id: string): void {
  const existing = getMyBookingIds().filter((x) => x !== id);
  writeIds([id, ...existing]);
}

export function removeMyBookingId(id: string): void {
  writeIds(getMyBookingIds().filter((x) => x !== id));
}

/** Reactive hook — re-renders when the saved-ids list changes (same tab or other tab). */
export function useMyBookingIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => getMyBookingIds());
  useEffect(() => {
    const refresh = () => setIds(getMyBookingIds());
    window.addEventListener('ap:my-bookings-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('ap:my-bookings-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return ids;
}
