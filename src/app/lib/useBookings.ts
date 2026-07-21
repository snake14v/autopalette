// Fetch a set of bookings by id (for Home / My bookings). Guest bookings have no list
// query capability by design, so we fetch each id individually through the driver.
import { useEffect, useState } from 'react';
import type { Booking } from '../../shared/types';
import { driver } from './driver';

export interface LoadedBooking {
  id: string;
  booking: Booking | null; // null = id no longer resolves (removed / wrong device)
}

export function useBookingsByIds(ids: string[]): { items: LoadedBooking[]; loading: boolean } {
  const [items, setItems] = useState<LoadedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const key = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      ids.map(async (id) => ({ id, booking: await driver.getBooking(id).catch(() => null) }))
    ).then((results) => {
      if (cancelled) return;
      setItems(results);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, loading };
}
