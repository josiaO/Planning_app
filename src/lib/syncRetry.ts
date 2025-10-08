import db from './db';
import sync from './sync';

let retryTimer: any = null;
let currentBackoff = 5000; // 5s initial
const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes

export async function persistFailedEntries(entries: any[]) {
  try {
    for (const e of entries) {
      // ensure local history contains the entry and mark unsynced
      try {
        await db.history.put({ ...e, synced: false });
      } catch (err) {
        // best-effort
        console.warn('persistFailedEntries: put failed', err);
      }
    }
    // kickoff retry loop
    scheduleRetry();
  } catch (e) {
    console.warn('persistFailedEntries failed', e);
  }
}

async function getUserIdFromCache() {
  try {
    const cache = await db.auth_cache.get('primary');
    return cache?.user?.id || cache?.email || null;
  } catch (e) { return null; }
}

export function scheduleRetry() {
  if (retryTimer) return; // already running
  currentBackoff = 5000;
  (async function loop() {
    try {
      const userId = await getUserIdFromCache();
      // try push
      const ok = await sync.pushLocalHistoryToServer(userId);
      if (ok) {
        // reset backoff and stop
        currentBackoff = 5000;
        clearTimeout(retryTimer);
        retryTimer = null;
        return;
      }
    } catch (e) {
      // ignore and retry
    }
    // schedule next
    currentBackoff = Math.min(MAX_BACKOFF, Math.floor(currentBackoff * 1.8));
    retryTimer = setTimeout(loop, currentBackoff);
  })();
}

export function stopRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export default { persistFailedEntries, scheduleRetry, stopRetry };
