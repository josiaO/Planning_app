import { useEffect, useState } from 'react';
import { usePlans } from '../contexts/PlansContext';
import { WifiSyncServer } from '../lib/wifiSyncServer';

export default function Sync(){
  const { startGoogleAuth, uploadToGoogleDrive, exportAllData, importAllData } = usePlans() as any;
  const [status, setStatus] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [wifiSyncPort, setWifiSyncPort] = useState(8080);
  const [wifiSyncActive, setWifiSyncActive] = useState(false);
  const [wifiSyncUrl, setWifiSyncUrl] = useState('');
  const [wifiServer, setWifiServer] = useState<WifiSyncServer | null>(null);

  useEffect(()=>{
    // Check for last sync time
    const checkLastSync = async () => {
      try {
        const { db } = await import('../lib/db');
        const setting = await db.settings.get('last_backup_at');
        if (setting?.value) {
          setLastSync(new Date(setting.value).toLocaleString());
        }
      } catch (e) {
        console.error('Failed to check last sync:', e);
      }
    };
    checkLastSync();
  },[]);

  const syncNow = async () => {
    try{
      setStatus('Uploading to Google Drive...');
      const ok = await uploadToGoogleDrive(`mission-control-sync-${new Date().toISOString()}.json`);
      if (ok) {
        setStatus('Upload complete');
        setLastSync(new Date().toLocaleString());
      } else {
        setStatus('Upload failed');
      }
    }catch(e:any){ setStatus(e.message || 'Sync failed'); }
  };

  const pullLatest = async () => {
    try{
      setStatus('Pulling latest from Google Drive...');
      // Get access token from stored auth
      const { db } = await import('../lib/db');
      const authCache = await db.auth_cache.get('gdrive') as any;
      if (!authCache?.access_token) {
        setStatus('Please connect Google Drive first');
        return;
      }
      
      // List files to find the latest sync file
      const listRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name contains "mission-control-sync"&orderBy=modifiedTime desc&maxResults=5', {
        headers: { Authorization: `Bearer ${authCache.access_token}` }
      });
      
      if (!listRes.ok) {
        setStatus('Failed to list files. Try reconnecting Google Drive.');
        return;
      }
      
      const listData = await listRes.json();
      const files = listData.files || [];
      
      if (files.length === 0) {
        setStatus('No sync files found. Upload one first.');
        return;
      }
      
      // Download the latest file
      const latestFile = files[0];
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${authCache.access_token}` }
      });
      
      if (!downloadRes.ok) {
        setStatus('Failed to download file');
        return;
      }
      
      const json = await downloadRes.json();
      await importAllData(json);
      setStatus(`Pull complete - loaded ${latestFile.name}`);
    }catch(e:any){ 
      console.error('Pull failed:', e);
      setStatus(e.message || 'Pull failed'); 
    }
  };

  const exportLocal = async () => {
    const payload = await exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mission-control-export-${new Date().toISOString()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const importFromFile = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setStatus('Importing from file...');
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      setStatus(`Import complete - loaded ${file.name}`);
      setLastSync(new Date().toLocaleString());
    } catch (error: any) {
      setStatus(`Import failed: ${error.message}`);
    }
    
    // Reset input
    event.target.value = '';
  };

  const startWifiSync = async () => {
    try {
      setStatus('Starting WiFi sync server...');
      
      const server = new WifiSyncServer(wifiSyncPort);
      const url = await server.start(exportAllData);
      
      setWifiServer(server);
      setWifiSyncUrl(url);
      setWifiSyncActive(true);
      setStatus(`WiFi sync active! Share this URL with other devices: ${url}`);
    } catch (error: any) {
      setStatus(`Failed to start WiFi sync: ${error.message}`);
    }
  };

  const stopWifiSync = () => {
    if (wifiServer) {
      wifiServer.stop();
      setWifiServer(null);
    }
    setWifiSyncActive(false);
    setWifiSyncUrl('');
    setStatus('WiFi sync stopped');
  };

  const syncFromWifiUrl = async () => {
    const url = prompt('Enter the WiFi sync URL from another device:');
    if (!url) return;
    
    try {
      setStatus('Syncing from WiFi...');
      const response = await fetch(`${url}/sync-data`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      await importAllData(data);
      setStatus('WiFi sync complete!');
      setLastSync(new Date().toLocaleString());
    } catch (error: any) {
      setStatus(`WiFi sync failed: ${error.message}`);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Sync</h1>
      <p className="text-slate-400">Export/Import your full dataset or sync via Google Drive</p>
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="text-sm text-slate-400 mb-3">
          <strong>Setup Instructions:</strong><br/>
          1. Go to <a href="https://console.developers.google.com" target="_blank" className="text-cyan-400 hover:text-cyan-300">Google Cloud Console</a><br/>
          2. Create a new project or select existing one<br/>
          3. Enable Google Drive API<br/>
          4. Create OAuth 2.0 credentials (Web application)<br/>
          5. Add authorized redirect URI: <code className="bg-slate-800 px-1 rounded">http://localhost:5173/oauth-callback.html</code><br/>
          6. Copy Client ID to your <code className="bg-slate-800 px-1 rounded">.env</code> file as <code className="bg-slate-800 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code><br/>
          <br/>
          <strong>If you get "Access blocked" error:</strong><br/>
          7. Go to OAuth consent screen → Test users → Add your email: <code className="bg-slate-800 px-1 rounded">josia.obeid@gmail.com</code><br/>
          8. Or publish the app if you want public access
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async () => {
            try {
              const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
              if (!clientId) {
                setStatus('Error: Google Client ID not configured in .env file');
                return;
              }
              
              await startGoogleAuth();
              setStatus('Opening Google authentication...');
            } catch (error: any) {
              setStatus(`Error: ${error.message}`);
            }
          }} className="px-3 py-2 bg-slate-700 rounded text-white hover:bg-slate-600">Connect Google Drive</button>
          <button type="button" onClick={syncNow} className="px-3 py-2 bg-cyan-600 rounded text-white hover:bg-cyan-700">Sync Now (Upload)</button>
          <button type="button" onClick={pullLatest} className="px-3 py-2 bg-indigo-600 rounded text-white hover:bg-indigo-700">Pull Latest</button>
          <button type="button" onClick={exportLocal} className="px-3 py-2 bg-slate-700 rounded text-white hover:bg-slate-600">Export JSON</button>
        </div>
        
        {/* USB/File Sync Section */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">USB / File Sync</h3>
          <p className="text-sm text-slate-400 mb-3">
            Export to USB drive or import from a backup file. Perfect for offline sync between devices.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportLocal} className="px-3 py-2 bg-green-600 rounded text-white hover:bg-green-700">
              📁 Export to USB/File
            </button>
            <label className="px-3 py-2 bg-blue-600 rounded text-white hover:bg-blue-700 cursor-pointer">
              📂 Import from USB/File
              <input
                type="file"
                accept=".json"
                onChange={importFromFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* WiFi/LAN Sync Section */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">WiFi / LAN Sync</h3>
          <p className="text-sm text-slate-400 mb-3">
            Sync between devices on the same network. One device shares data, others connect to it.
          </p>
          
          {!wifiSyncActive ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300">Port:</label>
                <input
                  type="number"
                  value={wifiSyncPort}
                  onChange={(e: any) => setWifiSyncPort(Number(e.target.value))}
                  className="w-20 px-2 py-1 bg-slate-800 text-white rounded text-sm"
                  min="1024"
                  max="65535"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={startWifiSync} className="px-3 py-2 bg-purple-600 rounded text-white hover:bg-purple-700">
                    📡 Start WiFi Sync Server
                  </button>
                  <button type="button" onClick={syncFromWifiUrl} className="px-3 py-2 bg-orange-600 rounded text-white hover:bg-orange-700">
                    📱 Connect to WiFi Sync
                  </button>
                </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800/50 p-3 rounded">
                <p className="text-sm text-green-400 mb-2">✅ WiFi Sync Active</p>
                <p className="text-xs text-slate-300 break-all">Share this URL: <code className="bg-slate-700 px-1 rounded">{wifiSyncUrl}</code></p>
              </div>
              <button type="button" onClick={stopWifiSync} className="px-3 py-2 bg-red-600 rounded text-white hover:bg-red-700">
                🛑 Stop WiFi Sync
              </button>
            </div>
          )}
        </div>
        
        {lastSync && (
          <div className="text-xs text-slate-400">
            Last sync: {lastSync}
          </div>
        )}
        {status && (
          <div className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}


