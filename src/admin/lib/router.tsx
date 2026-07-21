// Minimal hash router for the admin app. No dependency — the app is a handful of routes.
//
// Routes:
//   #/                             (admin home = Data panel)
//   #/login
//   #/myday                        (staff — role-gated)
//   #/employees                    (roster CRUD, admin)
//   #/dayboard                     (day board, admin)
//   #/customers                    (registry list, admin)
//   #/customers/:phone             (customer detail, admin)
//   #/bookings                     (inbox)
//   #/bookings/:id                 (detail)
//   #/jobcards                     (list)
//   #/jobcards/:id                 (editor)
//   #/jobcards/:id/invoice         (printable invoice)
//
// Navigation guard: the job-card editor registers a guard while it has unsaved changes.
// navigate() and browser back/forward both consult it before allowing a route change.

import { useEffect, useState } from 'react';

export interface Route {
  name:
    | 'home'
    | 'login'
    | 'myday'
    | 'employees'
    | 'dayboard'
    | 'customers'
    | 'customer-detail'
    | 'bookings'
    | 'booking-detail'
    | 'jobcards'
    | 'jobcard-editor'
    | 'jobcard-invoice'
    | 'not-found';
  params: Record<string, string>;
  hash: string;
}

// --- navigation guard -------------------------------------------------------------------

let guard: (() => boolean) | null = null;

/** Register a predicate that returns true when it is safe to leave the current route. */
export function setNavGuard(fn: (() => boolean) | null): void {
  guard = fn;
}

function mayLeave(): boolean {
  return guard ? guard() : true;
}

/** Public check for non-navigation exits (e.g. sign out) that should still honor the guard. */
export function canLeave(): boolean {
  const ok = mayLeave();
  if (ok) setNavGuard(null);
  return ok;
}

// --- parsing ----------------------------------------------------------------------------

export function parseHash(rawHash: string): Route {
  const hash = rawHash.replace(/^#/, '') || '/';
  const segments = hash.split('/').filter(Boolean); // e.g. ['jobcards','abc','invoice']

  if (segments.length === 0) return { name: 'home', params: {}, hash };
  const [first, second, third] = segments;

  if (first === 'login') return { name: 'login', params: {}, hash };
  if (first === 'myday') return { name: 'myday', params: {}, hash };
  if (first === 'employees') return { name: 'employees', params: {}, hash };
  if (first === 'dayboard') return { name: 'dayboard', params: {}, hash };

  if (first === 'customers') {
    if (second) return { name: 'customer-detail', params: { phone: second }, hash };
    return { name: 'customers', params: {}, hash };
  }

  if (first === 'bookings') {
    if (second) return { name: 'booking-detail', params: { id: second }, hash };
    return { name: 'bookings', params: {}, hash };
  }

  if (first === 'jobcards') {
    if (second && third === 'invoice') {
      return { name: 'jobcard-invoice', params: { id: second }, hash };
    }
    if (second) return { name: 'jobcard-editor', params: { id: second }, hash };
    return { name: 'jobcards', params: {}, hash };
  }

  return { name: 'not-found', params: {}, hash };
}

// --- navigation -------------------------------------------------------------------------

/** Navigate to a route path (without the leading '#'). Respects the active nav guard. */
export function navigate(to: string): void {
  const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (target === window.location.hash) return;
  if (!mayLeave()) return;
  // Clearing the guard here prevents the guard from firing again on the resulting hashchange.
  setNavGuard(null);
  window.location.hash = target;
}

// --- hook -------------------------------------------------------------------------------

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    let lastHash = window.location.hash;
    let reverting = false;

    const onChange = () => {
      const newHash = window.location.hash;
      if (reverting) {
        reverting = false;
        lastHash = newHash;
        return;
      }
      // Guard applies to browser back/forward, which don't go through navigate().
      if (!mayLeave()) {
        reverting = true;
        window.location.hash = lastHash; // revert
        return;
      }
      setNavGuard(null);
      lastHash = newHash;
      setRoute(parseHash(newHash));
    };

    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
