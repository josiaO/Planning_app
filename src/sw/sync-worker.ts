/* Service Worker sync scaffold: listens for 'sync' events named 'sync-history' and tries to post local history to server via fetch.
   This is a best-effort scaffolding; you should implement a /api/sync/push server endpoint that accepts an array of history entries and inserts them into server DB, returning success.
*/

self.addEventListener('install', () => {
  // skipWaiting to activate immediately during development
  // @ts-ignore
  self.skipWaiting && self.skipWaiting();
});

self.addEventListener('activate', () => {
  // @ts-ignore
  self.clients && self.clients.claim && self.clients.claim();
});

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-history') {
    event.waitUntil((async () => {
      try {
        // Request client to send its local history payload via message
        const allClients = await (self as any).clients.matchAll({ includeUncontrolled: true });
        for (const c of allClients) {
          c.postMessage({ type: 'request-history-sync' });
        }
      } catch (e) {
        // swallow
      }
    })());
  }
});

self.addEventListener('message', (evt: any) => {
  const data = evt?.data;
  if (!data) return;
  if (data.type === 'push-history') {
    // worker received a history payload from client to push
    (async () => {
      const maxRetries = 3;
      let attempt = 0;
      let success = false;
      let lastDetails = '';
      while (attempt <= maxRetries && !success) {
        try {
          const res = await fetch('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: data.entries }) });
          lastDetails = await res.text();
          if (res.ok) { success = true; break; }
        } catch (e) {
          lastDetails = String(e);
        }
        const wait = 300 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        attempt++;
      }
      const clients = await (self as any).clients.matchAll({ includeUncontrolled: true });
      for (const c of clients) {
        c.postMessage({ type: 'push-history-result', ok: success, details: lastDetails });
      }
      if (!success) {
        // tell clients to persist payload for later retry
        for (const c of clients) {
          c.postMessage({ type: 'persist-failed-history', entries: data.entries });
        }
      }
    })();
  }
});
