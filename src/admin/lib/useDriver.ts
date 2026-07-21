// Thin React hooks over the shared DataDriver. The admin app codes ONLY against getDriver()
// (never a concrete driver), so it works identically in demo (localStorage) and live (Firestore).
//
// getDriver() is async (it dynamically imports the firestore driver only when Firebase
// config is present — see src/shared/data.ts), so this module resolves it via top-level
// await. Every importer sees the already-resolved DataDriver, not a Promise: ES module
// evaluation waits for a module's top-level await to settle before its importers run.

import { useEffect, useRef, useState } from 'react';
import { getDriver, type AuthState } from '../../shared/data';
import type { Booking, Customer, Employee, Jobcard, WorkItem } from '../../shared/types';

export const driver = await getDriver();
export const isDemo = driver.mode === 'demo';

/** Admin auth state. `signedIn === null` while the initial auth check is in flight. */
export function useAdminAuth(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => driver.onAdminAuth(setSignedIn), []);
  return signedIn;
}

/**
 * Wave-2 rich auth state: who's signed in, and whether as admin or a specific staff member.
 * `undefined` while the initial check is in flight (distinct from a signed-out AuthState).
 */
export function useAuth(): AuthState | undefined {
  const [state, setState] = useState<AuthState | undefined>(undefined);
  useEffect(() => driver.onAuth(setState), []);
  return state;
}

/** Live roster (sorted by loginId in the driver). null while loading. */
export function useEmployees(): Employee[] | null {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  useEffect(() => driver.subscribeEmployees(setEmployees), []);
  return employees;
}

/**
 * Live work items, optionally filtered by date and/or employee. Filter primitives are used
 * as effect deps directly, so the subscription re-establishes only when they actually change.
 */
export function useWorkItems(filter?: { date?: string; employeeId?: string }): WorkItem[] | null {
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const date = filter?.date;
  const employeeId = filter?.employeeId;
  useEffect(() => {
    setItems(null);
    return driver.subscribeWorkItems(setItems, { date, employeeId });
  }, [date, employeeId]);
  return items;
}

/** Live customer registry (newest first in the driver). null while loading. */
export function useCustomers(): Customer[] | null {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  useEffect(() => driver.subscribeCustomers(setCustomers), []);
  return customers;
}

/** Live list of all bookings (newest first — the driver sorts by createdAt desc). */
export function useBookings(): Booking[] | null {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  useEffect(() => driver.subscribeBookings(setBookings), []);
  return bookings;
}

/** Live single booking. Re-subscribes when the id changes. */
export function useBooking(id: string | undefined): Booking | null | undefined {
  // undefined = loading, null = not found
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  useEffect(() => {
    if (!id) {
      setBooking(null);
      return;
    }
    setBooking(undefined);
    return driver.subscribeBooking(id, setBooking);
  }, [id]);
  return booking;
}

/** Live list of all job cards (newest date first). */
export function useJobcards(): Jobcard[] | null {
  const [jobcards, setJobcards] = useState<Jobcard[] | null>(null);
  useEffect(() => driver.subscribeJobcards(setJobcards), []);
  return jobcards;
}

/**
 * One-shot job-card fetch. The editor owns its own working copy after load, so it does not
 * want a live subscription overwriting in-progress edits. Returns undefined while loading.
 */
export function useJobcardOnce(id: string | undefined): {
  jobcard: Jobcard | null | undefined;
  reload: () => void;
} {
  const [jobcard, setJobcard] = useState<Jobcard | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);
  const idRef = useRef(id);
  idRef.current = id;

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setJobcard(null);
      return;
    }
    setJobcard(undefined);
    driver
      .getJobcard(id)
      .then((jc) => {
        if (!cancelled) setJobcard(jc);
      })
      .catch(() => {
        if (!cancelled) setJobcard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, nonce]);

  return { jobcard, reload: () => setNonce((n) => n + 1) };
}
