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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
