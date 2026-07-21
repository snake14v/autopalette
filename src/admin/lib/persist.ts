// Wave 3 — tiny per-route UI preference persistence (last-used tab / filter). localStorage
// only; failures (private mode, quota) degrade silently to the caller's fallback. First visit
// to a route has no stored value, so the caller's default is used unchanged.

const PREFIX = 'ap:admin:ui:';

export function loadPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignore — persistence is best-effort */
  }
}
