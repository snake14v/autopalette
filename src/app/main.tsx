import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../shared/app.css';
import './app.css';
// Import for its module-level `beforeinstallprompt` listener — must run at startup so the
// one-shot install event is captured before any component mounts (see lib/pwa.ts).
import './lib/pwa';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA service worker — customer app ONLY (not admin, not the marketing site).
//
// WAVE5_SPEC section E.3 (audit-reproduced): a plain `window.addEventListener('load', ...)`
// silently never fires when this module (a `<script type="module">`, which the browser
// defers until after HTML parsing) happens to finish executing AFTER the `load` event has
// already fired — e.g. on a slow chunk fetch, a warm cache serving the rest of the page
// near-instantly, or a service-worker-controlled reload. The listener is then attached to
// an event that already happened, and registration never runs — matching the audit's
// "manual register works, auto doesn't" symptom. Fix: check `document.readyState` first and
// register immediately if `load` has already passed; otherwise wait for it as before.
function registerServiceWorker() {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('Service worker registration failed:', err);
  });
}

if ('serviceWorker' in navigator) {
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }
}
