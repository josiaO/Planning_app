import db, { AuthCacheRecord } from './db';

const PRIMARY_ID = 'primary';

export async function saveAuthCacheToDB(record: AuthCacheRecord) {
  try {
    await db.auth_cache.put({ ...record, id: PRIMARY_ID });
  } catch (e) {
    // ignore
  }
}

export async function loadAuthCacheFromDB(): Promise<AuthCacheRecord | null> {
  try {
    const r = await db.auth_cache.get(PRIMARY_ID);
    return r ?? null;
  } catch (e) {
    return null;
  }
}

export async function removeAuthCacheFromDB() {
  try {
    await db.auth_cache.delete(PRIMARY_ID);
  } catch (e) {
    // ignore
  }
}

// Migrate existing localStorage cache (if present) into Dexie and then remove it
export async function migrateLocalStorageCacheToDB(localKey: string) {
  try {
    const s = localStorage.getItem(localKey);
    if (!s) return false;
    const parsed = JSON.parse(s) as AuthCacheRecord;
    if (!parsed) return false;
    await saveAuthCacheToDB({ ...parsed, id: PRIMARY_ID });
    try { localStorage.removeItem(localKey); } catch (e) { /* ignore */ }
    // record migration log
    try {
      await db.settings.put({ id: 'auth_migration', key: 'auth_migration', value: { migratedAt: new Date().toISOString(), source: 'localStorage' } });
    } catch (e) { /* ignore */ }
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadMigrationLogFromDB() {
  try {
    const r = await db.settings.get('auth_migration');
    return r?.value ?? null;
  } catch (e) {
    return null;
  }

}
