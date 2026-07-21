// Hand-rolled hash router — no dependency. Routes:
//   #/            home
//   #/book        booking flow
//   #/track       track (id input)
//   #/track/:id   track a specific booking
//   #/mine        bookings saved on this device
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'book' }
  | { name: 'track'; id?: string }
  | { name: 'mine' }
  | { name: 'not-found' };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#/, '').replace(/^\/+/, '');
  const segments = clean.split('/').filter(Boolean);
  const [seg, ...rest] = segments;
  if (!seg) return { name: 'home' };
  if (seg === 'book') return { name: 'book' };
  if (seg === 'track') {
    const raw = rest[0];
    return { name: 'track', id: raw ? decodeURIComponent(raw) : undefined };
  }
  if (seg === 'mine') return { name: 'mine' };
  return { name: 'not-found' };
}

/** Programmatic navigation. `path` is a hash-less path like "/book" or "/track/bk_123". */
export function navigate(path: string): void {
  const target = '#' + path;
  if (window.location.hash === target) {
    // Same hash — force a re-render by dispatching the event manually.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
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
