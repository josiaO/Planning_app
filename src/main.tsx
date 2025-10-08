import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { persistFailedEntries } from './lib/syncRetry';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register sync service worker (best-effort)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/src/sw/sync-worker.ts').then(reg => {
    // Listen for messages from the worker requesting history payload
    navigator.serviceWorker.addEventListener('message', async (evt: any) => {
      const data = evt?.data;
      if (!data) return;
      if (data.type === 'request-history-sync') {
        // gather recent history from Dexie and post to service worker
        try {
          const db = (await import('./lib/db')).default;
          const entries = await db.history.orderBy('created_at').reverse().limit(200).toArray();
          reg.active?.postMessage({ type: 'push-history', entries });
        } catch (e) {
          // ignore
        }
      }
      if (data.type === 'push-history-result') {
        // receive result and mark local entries as synced when ok
        try {
          const db = (await import('./lib/db')).default;
          if (data.ok) {
            const entries = await db.history.orderBy('created_at').reverse().limit(200).toArray();
            for (const e of entries) {
              await db.history.update(e.id, { synced: true });
            }
            // Cancel retry loop if any
            try { (await import('./lib/syncRetry')).stopRetry(); } catch (e) {}
          }
        } catch (e) {}
      }
      if (data.type === 'persist-failed-history') {
        try { await persistFailedEntries(data.entries || []); } catch (e) { }
      }
    });
    // Attempt to register a background sync if supported
    try {
      // register background sync if supported
      // @ts-ignore - navigator.serviceWorker.registration may have sync
      if (reg && (reg as any).sync && typeof (reg as any).sync.register === 'function') {
        try { (reg as any).sync.register('sync-history').catch(()=>{}); } catch(e) {}
      }
    } catch (e) {}
  }).catch(() => {
    // ignore registration errors
  });
}
