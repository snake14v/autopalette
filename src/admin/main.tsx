import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../shared/app.css';
import './admin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA service worker — same script as the customer app (src/app/main.tsx), so admin AND all
// 5 employees can install /admin/ to their Android home screens (Wave 2 directive). Same
// scriptURL + root scope means the browser shares one registration with the customer app.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
