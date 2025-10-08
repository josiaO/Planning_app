import db from './db';

export type CloudToken = {
  provider: 'onedrive' | 'gdrive';
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
};

export async function saveCloudToken(provider: 'onedrive' | 'gdrive', token: CloudToken) {
  try {
    await db.settings.put({ id: `cloud_${provider}`, key: `cloud_${provider}`, value: token });
  } catch (e) { /* ignore */ }
}

export async function loadCloudToken(provider: 'onedrive' | 'gdrive') {
  try {
    const r = await db.settings.get(`cloud_${provider}`);
    return r?.value as CloudToken | undefined;
  } catch (e) { return undefined; }
}

export async function removeCloudToken(provider: 'onedrive' | 'gdrive') {
  try { await db.settings.delete(`cloud_${provider}`); } catch (e) { /* ignore */ }
}
