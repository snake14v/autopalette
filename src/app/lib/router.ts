// Hand-rolled hash router — no dependency. Routes:
//   #/                  home
//   #/book              booking flow (redirects to #/book/services)
//   #/book/:step        one hash entry per book-flow step (services|vehicle|contact|review) —
//                       gives the 4-step flow real history entries so hardware back moves one
//                       step instead of exiting the whole flow (WAVE5_SPEC section E.2).
//   #/track             track (id input)
//   #/track/:id         track a specific booking
//   #/mine              bookings saved on this device
import { useEffect, useState } from 'react';

/** The 4 book-flow steps, in order — shared between the router (for parsing/validating the
 * hash segment) and Book.tsx (for step sequencing). Single source of truth for the list. */
export const BOOK_STEPS = ['services', 'vehicle', 'contact', 'review'] as const;
export type BookStep = (typeof BOOK_STEPS)[number];

export type Route =
  | { name: 'home' }
  | { name: 'book'; step?: BookStep }
  | { name: 'track'; id?: string }
  | { name: 'mine' }
  | { name: 'not-found' };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#/, '').replace(/^\/+/, '');
  const segments = clean.split('/').filter(Boolean);
  const [seg, ...rest] = segments;
  if (!seg) return { name: 'home' };
  if (seg === 'book') {
    const raw = rest[0];
    const step = raw && (BOOK_STEPS as readonly string[]).includes(raw) ? (raw as BookStep) : undefined;
    return { name: 'book', step };
  }
  if (seg === 'track') {
    const raw = rest[0];
    return { name: 'track', id: raw ? decodeURIComponent(raw) : undefined };
  }
  if (seg === 'mine') return { name: 'mine' };
  return { name: 'not-found' };
}

/** Programmatic navigation. `path` is a hash-less path like "/book" or "/track/bk_123".
 * Pushes a new history entry (native `location.hash =` behaviour) — this is what gives the
 * book flow's steps individual back-button stops. */
export function navigate(path: string): void {
  const target = '#' + path;
  if (window.location.hash === target) {
    // Same hash — force a re-render by dispatching the event manually.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
}

/** Like `navigate`, but REPLACES the current history entry instead of pushing a new one —
 * for redirects that shouldn't add their own back-button stop (e.g. bare "#/book" normalizing
 * to "#/book/services"). `history.replaceState` doesn't fire `hashchange`, so it's dispatched
 * manually to keep `useRoute` subscribers in sync. */
export function replaceRoute(path: string): void {
  history.replaceState(null, '', '#' + path);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Build an href for a route (for real <a> links so they're keyboard/right-click friendly). */
export function href(path: string): string {
  return '#' + path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
