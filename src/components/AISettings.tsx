import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import db from '../lib/db';
import secure from '../lib/secure';
import { setSessionApiKey, setSessionModel, getSessionApiKey, setSessionProvider, agentChat } from '../lib/aiAssistant';

export default function AISettings({ onClose }:{ onClose: ()=>void }) {
  const { user, revalidateOnline } = useAuth();
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai'|'google'|'openrouter'|'mock'>('google');
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [projection, setProjection] = useState('');
  const [stored, setStored] = useState<any>(null);
  const [showAddKey, setShowAddKey] = useState(false);
  // Client-side curated list matching server's OpenRouter list to avoid requiring server during dev
  const OPENROUTER_MODELS = [
    'meta-llama/llama-3.1-8b-instruct',
    'google/gemini-1.5-flash',
    'google/gemini-1.5-pro',
    'openchat/openchat-3.5',
    'gryphe/mythomax-l2-13b',
    'nousresearch/nous-hermes-2-vision',
    'nousresearch/nous-hermes-2-pro',
    'undi95/toppy-m-7b',
    'neversleep/noromaid-mixtral',
    'google/gemini-2.5-flash-image-preview'
  ];
  // curated Google and OpenAI examples for UI when key is not provided
  const GOOGLE_MODELS = ['text-bison-001', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4'];
  const [status, setStatus] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [apiKeyIsEncrypted, setApiKeyIsEncrypted] = useState(false);
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await db.settings.get('ai');
      setStored(s || null);
      if (s && s.projection) setProjection(s.projection);
      if (s && s.provider) setProvider(s.provider);
      if (s && s.model) setModel(s.model);
      // Ensure the session model is set from stored settings so the assistant uses it on start
      if (s && s.model) {
        try { setSessionModel(s.model); } catch (e) {}
      }
      // provide a helpful default model per provider
      if (!s?.model && (!s || !s.model)) {
        if ((s && s.provider) === 'google' || (!s && provider === 'google')) setModel('text-bison-001');
        if ((s && s.provider) === 'openai' || (!s && provider === 'openai')) setModel('gpt-4o-mini');
      }
    })();
  }, []);

  // Detect if API key field contains an encrypted payload
  useEffect(() => {
    let encrypted = false;
    try {
      const parsed = JSON.parse(apiKey);
      if (parsed && parsed.ciphertext && parsed.salt && parsed.iv) encrypted = true;
    } catch (e) { encrypted = false; }
    setApiKeyIsEncrypted(encrypted);
  }, [apiKey]);

  // Helper to fetch models; call when provider changes or API key changes / unlock state
  async function fetchModels(providerArg?: string) {
    try {
      setLoadingModels(true);
      const s = await db.settings.get('ai');
      let availableKey: string | null = null;
      if (s && !locked) {
        try { availableKey = await secure.decryptWithPassword(s.value, password); } catch (e) { availableKey = null; }
      }
      if (!availableKey && apiKey) availableKey = apiKey;
      // fallback to session key (setSessionApiKey) so Load models works right after saving
      if (!availableKey) {
        try { const sk = getSessionApiKey(); if (sk) availableKey = sk; } catch (e) { /* ignore */ }
      }
      const prov = providerArg || provider;
      // If provider has a client-side curated list, use it immediately (no server required)
      if (prov === 'openrouter') {
        setModelOptions(OPENROUTER_MODELS);
        setStatus('Loaded OpenRouter curated models');
        return;
      }
      if (prov === 'mock') {
        setModelOptions(['mock-model']);
        setStatus('Loaded mock provider models');
        return;
      }

      if ((prov === 'google' || prov === 'openai') && !availableKey) {
        // No API key available — show curated examples so the user can pick common models.
        setModelOptions(prov === 'google' ? GOOGLE_MODELS : OPENAI_MODELS);
        setStatus('Showing curated model examples. To list all available models, enter your API key and click "Load models".');
        return;
      } else {
        const body: any = { provider: prov };
        if (availableKey) body.api_key = availableKey;
        const res = await fetch('/api/agent/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) {
          // try to read error body for helpful message
          let text = '';
          try { text = await res.text(); } catch (e) { text = String(e); }
          setModelOptions([]);
          setStatus(`Failed to list models: ${res.status} ${text}`);
          return;
        }
        const j = await res.json();
        if (j && Array.isArray(j.models)) {
          setModelOptions(j.models);
          setStatus('');
        } else {
          setModelOptions([]);
          setStatus('No models returned from server');
        }
      }
    } catch (e) {
      setModelOptions([]);
      setStatus('Error while fetching models: ' + (e as any)?.message || String(e));
    } finally { setLoadingModels(false); }
  }

  useEffect(() => { fetchModels(); }, [provider, locked, apiKey, password]);

  // Keep the in-memory session values in sync while user edits provider/api key
  useEffect(() => {
    if (apiKeyIsEncrypted && password) {
      try {
        const parsed = JSON.parse(apiKey);
        if (parsed && parsed.ciphertext) {
            secure.decryptWithPassword(parsed, password).then((plain) => {
              setSessionApiKey(plain);
            if (process.env.NODE_ENV === 'development') {
              // Masked debug log
              const mask = (k:string) => k ? k.slice(0,4) + '...' + k.slice(-4) : '';
              // eslint-disable-next-line no-console
              console.debug('[AISettings] Session API key set:', mask(plain));
            }
          }).catch(() => {
            setSessionApiKey(null);
          });
        }
      } catch (e) {
        setSessionApiKey(null);
      }
    } else {
      setSessionApiKey(apiKey || null);
      if (process.env.NODE_ENV === 'development' && apiKey) {
        const mask = (k:string) => k ? k.slice(0,4) + '...' + k.slice(-4) : '';
        // eslint-disable-next-line no-console
        console.debug('[AISettings] Session API key set:', mask(apiKey));
      }
    }
    try { setSessionProvider(provider); } catch (e) {}
    }, [apiKey, provider, apiKeyIsEncrypted, password]);

  // (promptForPasswordIfNeeded removed - unused)

  const handleUnlock = async () => {
    if (!navigator.onLine) { setStatus('Must be online to unlock'); return; }
  if (!stored) { setStatus('No saved key. Enter a password and API to save.'); setLocked(false); return; }
    try {
      let plain: string | null = null;
      // stored.value may be an encrypted payload (object) or plaintext string (fallback)
      try {
        if (stored && stored.value && typeof stored.value === 'string') {
          plain = stored.value as string;
        } else {
          plain = await secure.decryptWithPassword(stored.value, password);
        }
      } catch (e) {
        // decryption failed
        throw e;
      }
  setApiKey(plain);
  setSessionApiKey(plain);
    // set session provider from stored or UI
    try { setSessionProvider(stored.provider || provider); } catch (e) {}
      // if stored provider/model exist, use them in UI
      if (stored.provider) setProvider(stored.provider);
      if (stored.model) setModel(stored.model);
  // set resolved session model (so client will use it immediately)
  setSessionModel(stored.model || model || 'text-bison-001');
      setLocked(false);
      setStatus('Unlocked');
      try { fetchModels(); } catch (e) {}
    } catch (e:any) {
      setStatus(e.message || 'Unlock failed');
    }
  };

  // After unlocking, attempt to verify stored model against provider models
  useEffect(() => {
    (async () => {
      if (!stored || locked) return;
      try {
        const plain = await secure.decryptWithPassword(stored.value, password).catch(()=>null);
        if (!plain) return;
        // set session key and model
        setSessionApiKey(plain);
        if (stored.model) setSessionModel(stored.model);
        // verify model
        const body: any = { provider, api_key: plain };
        const res = await fetch('/api/agent/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { setStatus('Unlocked, but model verification failed'); return; }
        const j = await res.json();
        const models: string[] = Array.isArray(j?.models) ? j.models : [];
        const found = stored.model && (models.includes(stored.model) || models.includes(`models/${stored.model}`) || models.includes(stored.model.replace(/^openrouter:/, '')));
        if (!found) setStatus('Unlocked, but saved model not listed for provider');
      } catch (e:any) {
        // ignore verification errors
      }
    })();
  }, [stored, locked]);

  const handleSave = async () => {
    if (!apiKey) { setStatus('API key empty'); return; }
    if (!password) { setStatus('Password required to encrypt'); return; }
    try {
      let payload: any = null;
      try {
        payload = await secure.encryptWithPassword(apiKey, password);
      } catch (e:any) {
        // If encryption not available, ask user to confirm storing plaintext (explicit opt-in)
        const ok = window.confirm('Encryption unavailable in this environment. Do you want to store the API key unencrypted locally? (Only do this on a private device)');
        if (!ok) { setStatus('Save cancelled (encryption unavailable)'); return; }
        payload = apiKey; // store plaintext as fallback
      }
      try {
        await db.settings.put({ id: 'ai', key: 'ai', value: payload, projection, provider, model });
        setStored({ id: 'ai', key: 'ai', value: payload, projection, provider, model });
      } catch (e:any) {
        setStatus('Failed to save encrypted key to local DB: ' + (e?.message || String(e)));
        return;
      }
      // set session key immediately so the assistant can use it in this session
      setSessionApiKey(apiKey);
  try { setSessionProvider(provider); } catch (e) {}
      // set session model immediately
      setSessionModel(model || 'text-bison-001');
    // Try to verify the chosen model with the provider by calling the server's models endpoint.
    try {
      const body: any = { provider };
      if (apiKey) body.api_key = apiKey;
      const res = await fetch('/api/agent/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        setStatus('Saved locally, but model verification failed (could not list models)');
      } else {
        const j = await res.json();
        const models: string[] = Array.isArray(j?.models) ? j.models : [];
        // Accept exact match or model reported with 'models/' prefix
        const found = models.includes(model) || models.includes(`models/${model}`) || models.includes(model.replace(/^openrouter:/, ''));
        if (found) setStatus('Saved and model verified');
        else setStatus('Saved, but model not found for provider (you may need to select a different model)');
      }
    } catch (e:any) {
      setStatus('Saved locally, but model verification failed: ' + (e?.message || String(e)));
    }
  setLocked(true);
  // keep apiKey populated so user can continue to Load models or verify; clear only password for security
  setPassword('');
    // refresh model list now that we've saved a key
    try { fetchModels(); } catch (e) {}
  } catch (e:any) {
    setStatus('Save failed: ' + (e?.message || String(e)));
  }
  };

  const handleTest = async () => {
    if (!navigator.onLine) { setStatus('Must be online to test AI'); return; }
    setStatus('Testing AI with current settings...');
    setTestResult(null);
    try {
      // Resolve API key: support plaintext key in the API input or a pasted encrypted payload JSON
      let resolvedKey: string | null = null;
      if (apiKey) {
        // Heuristic: if input looks like JSON with ciphertext, try to decrypt
        const looksLikeJson = apiKey.trim().startsWith('{');
        if (looksLikeJson) {
          try {
            const parsed = JSON.parse(apiKey);
            if (parsed && parsed.ciphertext) {
              if (!password) {
                setStatus('Encrypted payload detected in API key field — enter the encryption password to decrypt');
                return;
              }
              try {
                resolvedKey = await secure.decryptWithPassword(parsed, password);
              } catch (e:any) {
                setStatus('Failed to decrypt pasted payload: ' + (e?.message || String(e)));
                return;
              }
            }
          } catch (e) {
            // not valid JSON - treat as plaintext below
          }
        }
        if (!resolvedKey) resolvedKey = apiKey;
      }
      // Ensure session values are set
      if (resolvedKey) setSessionApiKey(resolvedKey);
      else setSessionApiKey(apiKey || null);
      setSessionModel(model || 'text-bison-001');
      setSessionProvider(provider);
      const current = getSessionApiKey();
      if (!current) { setStatus('No API key available to test — enter or unlock a key'); return; }
      // small smoke test prompt
      const res = await agentChat('Connection test: please reply with a one-line OK message.');
      setTestResult(res);
      setStatus('Test successful');
    } catch (e:any) {
      setStatus('Test failed: ' + (e?.message || String(e)));
      setTestResult(null);
    }
  };

  // Helper: use account password (prompt) to populate the encryption password field.
  const useAccountPassword = async () => {
    const p = window.prompt('Enter your account password (used locally to encrypt your API key):');
    if (!p) return;
    setPassword(p);
    if (revalidateOnline) {
      try {
        setStatus('Verifying account password...');
        const ok = await revalidateOnline(p);
        setStatus(ok ? 'Account password verified' : 'Account password not verified (will still be used to encrypt locally)');
      } catch (e:any) {
        setStatus('Verification error: ' + (e?.message || String(e)));
      }
    }
  };

  const handleSaveProjection = async () => {
    const s = (await db.settings.get('ai')) || { id: 'ai', key: 'ai', value: null };
    s.projection = projection;
    await db.settings.put(s);
    setStatus('Projection saved');
  };

  return (
    <div className="p-4 bg-slate-900 rounded shadow-lg max-w-xl mx-auto">
      <h3 className="text-lg font-semibold mb-3">AI Settings</h3>
      <p className="text-sm text-slate-400 mb-2">Store an API key encrypted with a password. Unlock only when online.</p>

      {locked ? (
        <div>
          <label className="block text-sm text-slate-300">Password to unlock</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
          <div className="flex gap-2">
            <button type="button" onClick={handleUnlock} className="px-3 py-2 bg-cyan-600 rounded text-white">Unlock</button>
            <button type="button" onClick={onClose} className="px-3 py-2 bg-slate-700 rounded text-white">Close</button>
          </div>
          <div className="mt-3">
            <button type="button" onClick={()=>setShowAddKey(v=>!v)} className="px-3 py-2 mt-2 bg-slate-700 rounded text-white">{showAddKey ? 'Cancel' : 'Add new key'}</button>
            {showAddKey && (
              <div className="mt-2 p-2 bg-slate-800 rounded">
                <label className="block text-sm text-slate-300">Provider</label>
                <select value={provider} onChange={(e)=>{ const p = e.target.value as any; setProvider(p); setModelOptions([]); setStatus(''); }} className="w-full px-2 py-2 mb-2 bg-slate-700 text-white rounded">
                  <option value="google">Google (Generative)</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="mock">Mock (local)</option>
                </select>
                <label className="block text-sm text-slate-300">API Key</label>
                <input value={apiKey} onChange={(e)=>{ setApiKey(e.target.value); setModelOptions([]); setStatus(''); }} className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
                <label className="block text-sm text-slate-300">Encryption password</label>
                <div className="flex gap-2">
                  <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="flex-1 px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
                  <button type="button" onClick={useAccountPassword} className="px-2 py-2 bg-slate-700 rounded text-white">Use account pw</button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>fetchModels(provider)} className="px-3 py-2 bg-slate-700 rounded text-white">Load models</button>
                  <button type="button" onClick={handleSave} className="px-3 py-2 bg-emerald-600 rounded text-white">Save encrypted key</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm text-slate-300">Provider</label>
          <div className="flex items-center gap-2 mb-2">
            <select value={provider} onChange={(e)=>{ const p = e.target.value as any; setProvider(p); if (p === 'google') setModel('text-bison-001'); if (p === 'openai') setModel('gpt-4o-mini'); setModelOptions([]); setStatus(''); fetchModels(); }} className="flex-1 px-2 py-2 bg-slate-800 text-white rounded">
              <option value="google">Google (Generative)</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="mock">Mock (local)</option>
            </select>
            <button type="button" onClick={() => fetchModels()} className="px-3 py-2 bg-slate-700 rounded text-white">Load models</button>
          </div>

          {/* If provider requires API key and none is available, show a hint */}
          {(provider === 'google' || provider === 'openai') && !apiKey && locked && !stored && (
            <div className="text-sm text-yellow-300 mb-2">This provider requires an API key to list models. Enter an API key below or unlock your saved key and click "Load models".</div>
          )}

          <label className="block text-sm text-slate-300">Model (pick from list or enter custom)</label>
          {loadingModels ? (
            <div className="text-sm text-slate-400">Loading models...</div>
          ) : modelOptions.length > 0 ? (
            <select value={model} onChange={(e)=>setModel(e.target.value)} className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded">
              <option value="">-- choose a model --</option>
              {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={model} onChange={(e)=>setModel(e.target.value)} className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
          )}

          {/* modelOptions are shown in the select above; quick-pick buttons removed for a simpler UI */}

          <label className="block text-sm text-slate-300">API Key</label>
          <div className="relative">
            <input
              value={apiKey}
              onChange={(e)=>{ setApiKey(e.target.value); setModelOptions([]); setStatus(''); }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                let isEncrypted = false;
                try {
                  const parsed = JSON.parse(pasted);
                  if (parsed && parsed.ciphertext && parsed.salt && parsed.iv) isEncrypted = true;
                } catch (err) { isEncrypted = false; }
                if (isEncrypted) {
                  setShowDecryptPrompt(true);
                  setApiKey(pasted);
                  setStatus('Encrypted payload detected. Please enter the password to decrypt.');
                  e.preventDefault();
                  return false;
                }
                setShowDecryptPrompt(false);
                return true;
              }}
              className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded pr-10"
            />
            {apiKeyIsEncrypted && (
              <span className="absolute right-2 top-2 flex items-center text-yellow-400 text-xs gap-1">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-7V7a6 6 0 1 0-12 0v3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-8-3a4 4 0 1 1 8 0v3H6V7Zm10 12H6v-7h12v7Z"/></svg>
                Encrypted
              </span>
            )}
          </div>
          {showDecryptPrompt && apiKeyIsEncrypted && (
            <div className="mb-2 text-xs text-yellow-300">Encrypted API key detected. Enter password above to decrypt and use.</div>
          )}
          <label className="block text-sm text-slate-300">Encryption password (use your account password to encrypt)</label>
          <div className="flex gap-2">
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="flex-1 px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
            <button type="button" onClick={useAccountPassword} className="px-2 py-2 bg-slate-700 rounded text-white">Use account pw</button>
          </div>
          {user?.email && <div className="text-xs text-slate-400 mb-2">Using account: {user.email}</div>}
          <label className="block text-sm text-slate-300">Projection (user-provided)</label>
          <input value={projection} onChange={(e)=>setProjection(e.target.value)} className="w-full px-2 py-2 mb-2 bg-slate-800 text-white rounded" />
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="px-3 py-2 bg-emerald-600 rounded text-white">Save encrypted key</button>
            <button type="button" onClick={handleSaveProjection} className="px-3 py-2 bg-indigo-600 rounded text-white">Save projection</button>
            <button type="button" onClick={handleTest} className="px-3 py-2 bg-violet-600 rounded text-white">Test AI</button>
            <button type="button" onClick={() => { setLocked(true); setApiKey(''); setPassword(''); }} className="px-3 py-2 bg-slate-700 rounded text-white">Lock</button>
          </div>
          {testResult && <div className="mt-2 p-2 bg-slate-800 text-sm text-slate-200">Test result: {testResult}</div>}
        </div>
      )}

      {status && <div className="mt-2 text-sm text-slate-300">{status}</div>}
    </div>
  );
}
