import db from './db';
import { supabase } from './supabase';

// Generic retry helper with exponential backoff
async function retry<T>(fn: () => Promise<T> | any, retries = 3, baseMs = 300) : Promise<T> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= retries) {
    try {
      const res = fn();
      // If fn returns a Postgrest builder, it may not be a proper Promise, so wrap in Promise.resolve
      return await Promise.resolve(res) as T;
    } catch (e) {
      lastErr = e;
      const wait = baseMs * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

// Push local history entries to Supabase with simple conflict resolution using timestamps.
export type PushResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ id: string; table: string; error: string }>;
  items: Array<{ id: string; table: string; action: string; status: 'inserted'|'updated'|'skipped'|'failed'; error?: string }>;
};

export async function pushLocalHistoryToServer(userId: string): Promise<PushResult> {
  const result: PushResult = { ok: true, inserted: 0, updated: 0, skipped: 0, errors: [], items: [] };
  try {
    const pendingAll = await db.history.orderBy('created_at').limit(1000).toArray();
    const pending = pendingAll.filter((p:any)=> p.data?.user_id === userId && !p.synced);
    for (const h of pending) {
      try {
        const item = { ...h.data, id: h.record_id, last_modified: h.data?.updated_at || h.data?.created_at || h.created_at };
        const table = h.table_name;
        const existsRes = await retry(() => supabase.from(table).select('id, updated_at, created_at').eq('id', h.record_id).maybeSingle(), 2) as any;
        const exists = existsRes?.data as any | null;
        if (!exists) {
          await retry(() => supabase.from(table).insert(item as any).then(r=>{ if (r.error) throw r.error; return r; }), 2);
          result.inserted++;
          result.items.push({ id: h.record_id, table, action: h.action, status: 'inserted' });
        } else {
          const serverUpdated = exists.updated_at || exists.created_at;
          const localTs = new Date(item.last_modified || 0).getTime();
          const serverTs = new Date(serverUpdated || 0).getTime();
          if (localTs > serverTs + 1000) {
            await retry(() => supabase.from(table).upsert(item as any).then(r=>{ if (r.error) throw r.error; return r; }), 2);
            result.updated++;
            result.items.push({ id: h.record_id, table, action: h.action, status: 'updated' });
          } else {
            result.skipped++;
            result.items.push({ id: h.record_id, table, action: h.action, status: 'skipped' });
          }
        }
        await db.history.update(h.id, { synced: true });
      } catch (e: any) {
        const err = String(e?.message || e || 'unknown');
        result.errors.push({ id: h.record_id, table: h.table_name, error: err });
        result.items.push({ id: h.record_id, table: h.table_name, action: h.action, status: 'failed', error: err });
        result.ok = false;
        console.warn('sync item failed', e);
      }
    }
    // persist a log entry
    try {
      await db.sync_logs.add({ id: crypto.randomUUID(), user_id: userId, result_json: JSON.stringify(result), created_at: new Date().toISOString() });
    } catch (e) { }
    return result;
  } catch (e: any) {
    const err = String(e?.message || e || 'unknown');
    console.warn('pushLocalHistoryToServer failed', e);
    const fallback = { ok: false, inserted: 0, updated: 0, skipped: 0, errors: [{ id: 'global', table: '', error: err }], items: [] } as PushResult;
    try { await db.sync_logs.add({ id: crypto.randomUUID(), user_id: userId, result_json: JSON.stringify(fallback), created_at: new Date().toISOString() }); } catch (e) {}
    return fallback;
  }
}

// Retry only failed items from a previous PushResult (re-push their history entries)
export async function retryFailedItems(userId: string, failedIds: string[]) {
  const res: PushResult = { ok: true, inserted: 0, updated: 0, skipped: 0, errors: [], items: [] };
  try {
    const entries = await db.history.where('record_id').anyOf(failedIds).toArray();
    for (const h of entries) {
      try {
        const item = { ...h.data, id: h.record_id, last_modified: h.data?.updated_at || h.data?.created_at || h.created_at };
        const table = h.table_name;
        const existsRes = await retry(() => supabase.from(table).select('id, updated_at, created_at').eq('id', h.record_id).maybeSingle(), 2) as any;
        const exists = existsRes?.data as any | null;
        if (!exists) {
          await retry(() => supabase.from(table).insert(item as any).then(r=>{ if (r.error) throw r.error; return r; }), 2);
          res.inserted++; res.items.push({ id: h.record_id, table, action: h.action, status: 'inserted' });
        } else {
          const serverUpdated = exists.updated_at || exists.created_at;
          const localTs = new Date(item.last_modified || 0).getTime();
          const serverTs = new Date(serverUpdated || 0).getTime();
          if (localTs > serverTs + 1000) {
            await retry(() => supabase.from(table).upsert(item as any).then(r=>{ if (r.error) throw r.error; return r; }), 2);
            res.updated++; res.items.push({ id: h.record_id, table, action: h.action, status: 'updated' });
          } else {
            res.skipped++; res.items.push({ id: h.record_id, table, action: h.action, status: 'skipped' });
          }
        }
        await db.history.update(h.id, { synced: true });
      } catch (e: any) {
        const err = String(e?.message || e || 'unknown');
        res.errors.push({ id: h.record_id, table: h.table_name, error: err });
        res.items.push({ id: h.record_id, table: h.table_name, action: h.action, status: 'failed', error: err });
        res.ok = false;
      }
    }
    try { await db.sync_logs.add({ id: crypto.randomUUID(), user_id: userId, result_json: JSON.stringify(res), created_at: new Date().toISOString() }); } catch (e) {}
    return res;
  } catch (e: any) {
    const err = String(e?.message || e || 'unknown');
    return { ok: false, inserted: 0, updated: 0, skipped: 0, errors: [{ id: 'global', table: '', error: err }], items: [] } as PushResult;
  }
}

export async function pullServerItemsIntoLocal(userId: string) {
  try {
    // Pull recent highlights/reflections/flashcards for user and upsert into local db
    const [hResRaw, rResRaw, fResRaw] = await Promise.all([
      retry(() => supabase.from('highlights').select('*').eq('user_id', userId).limit(500)),
      retry(() => supabase.from('reflections').select('*').eq('user_id', userId).limit(500)),
      retry(() => supabase.from('flashcards').select('*').eq('user_id', userId).limit(500)),
    ]);
    const hRes: any = hResRaw;
    const rRes: any = rResRaw;
    const fRes: any = fResRaw;
    if (hRes.data) {
      for (const h of hRes.data) {
        try {
          // merge: if local exists, pick the newest updated_at
          const local = await db.highlights.get(h.id as string);
          if (!local) await db.highlights.put(h as any);
          else {
            const localTs = new Date(local.updated_at || local.created_at || 0).getTime();
            const srvTs = new Date(h.updated_at || h.created_at || 0).getTime();
            if (srvTs > localTs + 1000) await db.highlights.put(h as any);
          }
        } catch (e) {}
      }
    }
    if (rRes.data) {
      for (const r of rRes.data) {
        try {
          const local = await db.reflections.get(r.id as string);
          if (!local) await db.reflections.put(r as any);
          else {
            const localTs = new Date(local.updated_at || local.created_at || 0).getTime();
            const srvTs = new Date(r.updated_at || r.created_at || 0).getTime();
            if (srvTs > localTs + 1000) await db.reflections.put(r as any);
          }
        } catch (e) {}
      }
    }
    if (fRes.data) {
      for (const f of fRes.data) {
        try {
          const local = await db.flashcards.get(f.id as string);
          if (!local) await db.flashcards.put(f as any);
          else {
            const localTs = new Date(local.updated_at || local.created_at || 0).getTime();
            const srvTs = new Date(f.updated_at || f.created_at || 0).getTime();
            if (srvTs > localTs + 1000) await db.flashcards.put(f as any);
          }
        } catch (e) {}
      }
    }
    return true;
  } catch (e) {
    console.warn('pullServerItemsIntoLocal failed', e);
    return false;
  }
}

export default { pushLocalHistoryToServer, pullServerItemsIntoLocal };
