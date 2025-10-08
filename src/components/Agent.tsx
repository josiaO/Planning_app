import { useState, useEffect } from 'react';

export default function Agent() {
  const [provider, setProvider] = useState<'openai'|'google'|'openrouter'>('google');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash-exp');
  const [temp, setTemp] = useState(0.2);
  const [projectRoot, setProjectRoot] = useState('.');
  const [activityFile, setActivityFile] = useState<File | null>(null);
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'actions'|'chat'>('actions');
  const [messages, setMessages] = useState<Array<{role:string,content:string}>>([]);
  const [chatInput, setChatInput] = useState('');

  // load stored provider/model and session api key if present
  useEffect(() => {
    (async () => {
      try {
        const s = await (await import('../lib/db')).default.settings.get('ai');
        if (s) {
          if (s.provider) setProvider(s.provider);
          if (s.model) setModel(s.model || model);
        }
        // load session key if available
        const { getSessionApiKey } = await import('../lib/aiAssistant');
        const sk = getSessionApiKey();
        if (sk) setApiKey(sk);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function callAction(action: 'analyze'|'behavior'|'predict'){
    setLoading(true);
    setOutput('');
    try{
      let activity_data = null;
      if (activityFile){
        const text = await activityFile.text();
        if (activityFile.name.endsWith('.json')) activity_data = JSON.parse(text);
      }
      if (!activity_data){
        try {
          const { buildContextSummary } = await import('../lib/aiAssistant');
          activity_data = await buildContextSummary();
        } catch (e) { /* ignore, optional */ }
      }
  const keyToSend = apiKey || (await (await import('../lib/aiAssistant')).getSessionApiKey());
  const body = { action, provider, api_key: keyToSend, model, temperature: temp, project_root: projectRoot, activity_data };
      const res = await fetch('/api/agent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await res.text();
      try {
        const j = JSON.parse(txt);
        if (!res.ok) throw new Error(j.detail || JSON.stringify(j));
        setOutput(j.text || JSON.stringify(j));
      } catch (e) {
        if (!res.ok) setOutput(`Agent proxy error (${res.status}): ${txt}`);
        else setOutput(txt || 'OK');
      }
    }catch(e:any){
      setOutput('Error: ' + (e.message || String(e)));
    }finally{setLoading(false)}
  }

  async function sendChat(){
    if (!chatInput.trim()) return;
    const newMsg = { role: 'user', content: chatInput.trim() };
    const hist = [...messages, newMsg];
    setMessages(hist);
    setChatInput('');
    setLoading(true);
    try{
  const keyToSend = apiKey || (await (await import('../lib/aiAssistant')).getSessionApiKey());
      let activity_data: any = null;
      try {
        const { buildContextSummary } = await import('../lib/aiAssistant');
        activity_data = await buildContextSummary();
      } catch (e) { /* optional context */ }
  const body = { provider, api_key: keyToSend, model, temperature: temp, project_root: projectRoot, activity_data, messages: hist };
      const res = await fetch('/api/agent/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || JSON.stringify(j));
      const reply = j.text || '';
      const replyMsg = { role: 'assistant', content: reply };
      setMessages(prev => [...prev, replyMsg]);
    }catch(e:any){
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (e.message || String(e)) }]);
    }finally{ setLoading(false); }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Agent</h2>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setTab('actions')} className={`px-3 py-2 rounded ${tab==='actions' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Actions</button>
        <button type="button" onClick={() => setTab('chat')} className={`px-3 py-2 rounded ${tab==='chat' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Chat</button>
      </div>
      {tab === 'actions' && (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value as any)} className="w-full p-2 bg-slate-800 text-white rounded">
            <option value="google">Google Gemini 2.5 Flash</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>

          <label className="block text-sm mt-2">API key</label>
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="w-full p-2 bg-slate-800 text-white rounded" />

          <label className="block text-sm mt-2">Model</label>
          <input value={model} onChange={e=>setModel(e.target.value)} className="w-full p-2 bg-slate-800 text-white rounded" />

          <label className="block text-sm mt-2">Temperature: {temp}</label>
          <input type="range" min="0" max="1" step="0.05" value={String(temp)} onChange={e=>setTemp(Number(e.target.value))} className="w-full" />

          <label className="block text-sm mt-2">Project root</label>
          <input value={projectRoot} onChange={e=>setProjectRoot(e.target.value)} className="w-full p-2 bg-slate-800 text-white rounded" />

          <label className="block text-sm mt-2">Upload activity (optional)</label>
          <input type="file" onChange={e => setActivityFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm" />

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => callAction('analyze')} className="px-3 py-2 bg-cyan-600 rounded text-white">Analyze project</button>
            <button type="button" onClick={() => callAction('behavior')} className="px-3 py-2 bg-emerald-600 rounded text-white">Analyze behavior</button>
            <button type="button" onClick={() => callAction('predict')} className="px-3 py-2 bg-indigo-600 rounded text-white">Predict 1 year</button>
          </div>
        </div>
        <div>
          <h3 className="font-medium">Result</h3>
          <div className="mt-2 p-3 bg-slate-800 rounded min-h-[300px] whitespace-pre-wrap text-sm text-slate-200">{loading ? 'Working...' : output}</div>
        </div>
      </div>
      )}

      {tab === 'chat' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="p-3 bg-slate-800 rounded min-h-[400px] overflow-auto">
              {messages.map((m, i) => (
                <div key={i} className={`mb-3 p-2 rounded ${m.role==='user' ? 'bg-cyan-600/20' : 'bg-slate-700/40'}`}>
                  <div className="text-xs text-slate-400">{m.role}</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') sendChat(); }} className="flex-1 p-2 bg-slate-800 text-white rounded" placeholder="Ask the agent..." />
              <button type="button" onClick={sendChat} className="px-3 py-2 bg-cyan-600 rounded text-white">Send</button>
            </div>
          </div>
          <div>
            <h3 className="font-medium">Settings</h3>
            <div className="p-3 bg-slate-800 rounded">
              <div className="text-sm">Provider</div>
              <select value={provider} onChange={e => setProvider(e.target.value as any)} className="w-full p-2 bg-slate-700 text-white rounded mt-1">
                <option value="google">Google Gemini 2.5 Flash</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <div className="text-sm mt-2">API key (session)</div>
              <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="w-full p-2 bg-slate-700 text-white rounded mt-1" />
              <div className="text-sm mt-2">Model</div>
              <input value={model} onChange={e=>setModel(e.target.value)} className="w-full p-2 bg-slate-700 text-white rounded mt-1" />
              <div className="text-sm mt-2">Project root</div>
              <input value={projectRoot} onChange={e=>setProjectRoot(e.target.value)} className="w-full p-2 bg-slate-700 text-white rounded mt-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
