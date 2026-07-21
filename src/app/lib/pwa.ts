// Add-to-Home-Screen (PWA install) plumbing.
//
// The `beforeinstallprompt` event fires ONCE, early, and only if the browser decides the
// app is installable. If no listener is registered when it fires, the event is lost. So we
// register a MODULE-LEVEL listener here and import this module at startup (main.tsx) — the
// deferred event is captured before any React component mounts, then replayed on demand.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

// Registered at import time so the one-shot event is never missed.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  emit();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installed = true;
  emit();
});

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export function isInstalled(): boolean {
  return installed || window.matchMedia('(display-mode: standalone)').matches;
}

/** Show the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return choice.outcome === 'accepted';
}

/** Reactive hook — true while a native install prompt is available to replay. */
export function useCanInstall(): boolean {
  const [available, setAvailable] = useState<boolean>(canInstall());
  useEffect(() => {
    const update = () => setAvailable(canInstall());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return available;
}
