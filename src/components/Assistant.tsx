import { useEffect, useState } from 'react';
import { analyzeBehaviorSummary, predictOutcomesBrief, personalizedPathSuggestion, agentChat, getRecentMessages, agentSuggestions, projectOneYearOutcomes, getSessionApiKey } from '../lib/aiAssistant';
import AISettings from './AISettings';
import db from '../lib/db';
import { usePlans } from '../contexts/PlansContext';

export default function Assistant() {
  const { getMomentumTrend, getReflectionsBetween, listResilience, listGoals, listHabits, getSpendingForDay, getTimeUseForDay } = usePlans() as any;
  const [summary, setSummary] = useState<any>(null);
  const [prediction, setPrediction] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [goalPages, setGoalPages] = useState(20);
  const [personalized, setPersonalized] = useState<any>(null);
  const [projection, setProjection] = useState<any>(null);
  const [projectionMonths, setProjectionMonths] = useState<number>(12);
  const [userProjection, setUserProjection] = useState<string | null>(null);
  const [tab, setTab] = useState<'insights' | 'projection' | 'chat' | 'behavior'>('behavior');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [nudges, setNudges] = useState<string[]>([]);
  const [behaviorAnalysis, setBehaviorAnalysis] = useState<string>('');
  // AI config (moved to AI Settings). We read config from session/settings on-demand.

  async function currentAIConfig() {
    // get session API key if unlocked in this session
    const sessionKey = getSessionApiKey();
    // get stored provider/model from DB
    const s = await db.settings.get('ai');
    return {
      provider: s?.provider || 'google',
      model: s?.model || 'text-bison-001',
      api_key: sessionKey || null
    };
  }

  useEffect(() => {
    (async () => {
      const s = await analyzeBehaviorSummary();
      setSummary(s);
      const msgs = await getRecentMessages(30);
      setMessages(msgs);
      // load user-saved projection from settings (if any)
      const settings = await db.settings.get('ai');
      if (settings?.projection) setUserProjection(settings.projection as string);
      // build ethical nudges
      try {
        const tips: string[] = [];
        const trend = await getMomentumTrend(7);
        const last3 = trend.slice(-3).map((d:any)=>d.rating);
        if (last3.length===3 && last3.every((r:number)=>r<=1)) tips.push('Momentum dropped 3 days in a row — schedule a 15‑minute focus block today?');
        const end = new Date();
        const start = new Date(); start.setDate(end.getDate()-6);
        const reflections = await getReflectionsBetween(start.toISOString().slice(0,10), end.toISOString().slice(0,10));
        if ((reflections||[]).length >= 3) tips.push("You've logged multiple reflections — extract 1 actionable insight for this week.");
        const res = await listResilience(10);
        if ((res||[]).length >= 3) tips.push('You’ve logged 3+ setbacks — review the Resilience Log and plan a small next step.');
        const goals = await listGoals();
        if ((goals||[]).length > 0) tips.push('Pick one goal for today and link one time entry or expense to it.');
        setNudges(tips.length ? tips : ['No specific nudges right now. Keep up the steady progress!']);
      } catch {}
    })();
  }, []);

  const handlePredict = async () => {
    setLoading(true);
    const p = await predictOutcomesBrief();
    setPrediction(p);
    setLoading(false);
  };

  const handlePersonalize = async () => {
    setLoading(true);
    const res = await personalizedPathSuggestion({ kind: 'reading', details: { pagesPerWeek: goalPages } });
    setPersonalized(res);
    setLoading(false);
  };

  const handleProjectOneYear = async () => {
    setLoading(true);
    const res = await projectOneYearOutcomes();
    setProjection(res);
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!chatInput.trim()) return;
    setLoading(true);
    await agentChat(chatInput.trim());
    setChatInput('');
    const msgs = await getRecentMessages(30);
    setMessages(msgs);
    setLoading(false);
  };

  const loadSuggestions = async () => {
    setLoading(true);
    const ans = await agentSuggestions();
    setSuggestions(ans);
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">AI Assistant</h2>

      {summary && (
        <div className="mb-4 p-3 bg-slate-800/60 rounded">
          <p className="text-sm text-slate-300">Plans: {summary.plansCount} | Active: {summary.activePlans}</p>
          <p className="text-sm text-slate-300">Avg daily minutes focused: {summary.avgDailyMinutes}</p>
          <p className="text-sm text-slate-300">Avg daily spend: {summary.avgDailySpending}</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setTab('behavior')} className={`px-3 py-2 rounded ${tab==='behavior' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Behavior Analysis</button>
        <button type="button" onClick={() => setTab('insights')} className={`px-3 py-2 rounded ${tab==='insights' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Insights</button>
        <button type="button" onClick={() => setTab('projection')} className={`px-3 py-2 rounded ${tab==='projection' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Projection</button>
        <button type="button" onClick={() => setTab('chat')} className={`px-3 py-2 rounded ${tab==='chat' ? 'bg-cyan-600 text-white' : 'bg-slate-700/60 text-slate-200'}`}>Chat</button>
        <button type="button" onClick={()=>{ alert('Use Export/Upload buttons in Budget or upcoming Sync page.'); }} className={`px-3 py-2 rounded bg-slate-700/60 text-slate-200`}>Sync Now</button>
        <button
          type="button"
          onClick={() => {
            if (!navigator.onLine) return alert('Must be online to open AI settings');
            setShowSettings(true);
          }}
          className={`px-3 py-2 rounded bg-slate-700/60 text-slate-200`}
        >AI Settings</button>
      </div>

      {tab === 'behavior' && (
        <div>
          <div className="mb-4 p-4 bg-slate-800/60 rounded">
            <h3 className="text-lg font-semibold text-white mb-3">AI Configuration</h3>
            <p className="text-sm text-slate-300">Manage API key and model in AI Settings. Open settings to add or change your provider, key, or model.</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setShowSettings(true)} className="px-3 py-2 bg-emerald-600 rounded text-white">Open AI Settings</button>
              <button type="button" onClick={async ()=>{
                setLoading(true);
                try {
                  const cfg = await currentAIConfig();
                  if (!cfg.api_key) return alert('No API key unlocked in this session. Open AI Settings to unlock.');
                  const today = new Date().toISOString().slice(0,10);
                  const spending = await getSpendingForDay(today);
                  const timeUse = await getTimeUseForDay(today);
                  const habits = await listHabits();
                  const goals = await listGoals();
                  const reflections = await getReflectionsBetween(today, today);
                  const resilience = await listResilience(5);
                  const momentum = await getMomentumTrend(7);
                  const data = { spending: spending || [], timeUse: timeUse || [], habits: habits || [], goals: goals || [], reflections: reflections || [], resilience: resilience || [], momentum: momentum || [], summary };
                  const response = await fetch('/api/agent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze', provider: cfg.provider, api_key: cfg.api_key, model: cfg.model, temperature: 0.3, activity_data: data }) });
                  const text = await response.text();
                  try {
                    const result = JSON.parse(text);
                    if (!response.ok) {
                      const detail = result.detail || result;
                      setBehaviorAnalysis(`Error from agent proxy (${response.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
                    } else {
                      setBehaviorAnalysis(result.text || JSON.stringify(result));
                    }
                  } catch (e) {
                    if (!response.ok) setBehaviorAnalysis(`Agent proxy error (${response.status}): ${text}`);
                    else setBehaviorAnalysis(text || 'Analysis returned empty response');
                  }
                } finally { setLoading(false); }
              }} className="px-4 py-2 bg-cyan-600 rounded text-white">{loading ? 'Analyzing...' : 'Analyze My Behavior'}</button>
            </div>
          </div>

          {behaviorAnalysis && (
            <div className="p-4 bg-slate-800/60 rounded">
              <h3 className="text-lg font-semibold text-white mb-2">Behavior Analysis</h3>
              <div className="whitespace-pre-wrap text-slate-200 text-sm">{behaviorAnalysis}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'insights' && (
        <div>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={handlePredict} className="px-3 py-2 bg-cyan-600 rounded text-white">{loading ? 'Working...' : 'Predict outcomes'}</button>
            <button type="button" onClick={loadSuggestions} className="px-3 py-2 bg-emerald-600 rounded text-white">{loading ? 'Working...' : 'Personalized suggestions'}</button>
          </div>
          <div className="mb-4 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
            <h3 className="font-medium mb-1">Nudges</h3>
            <ul className="list-disc pl-5 space-y-1">
              {nudges.map((n,i)=>(<li key={i}>{n}</li>))}
            </ul>
          </div>
          {prediction && (
            <div className="mb-4 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
              {(() => {
                try {
                  const parsed = JSON.parse(prediction);
                  return <div>{String(parsed)}</div>;
                } catch {
                  return <div className="whitespace-pre-wrap">{prediction}</div>;
                }
              })()}
            </div>
          )}
          {suggestions && (
            <div className="mb-4 p-3 bg-slate-800/60 rounded whitespace-pre-wrap text-sm text-slate-200">{suggestions}</div>
          )}
            <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-1">Reading goal: pages per week</label>
            <input type="number" value={goalPages} onChange={(e) => setGoalPages(Number(e.target.value))} className="w-32 px-2 py-1 rounded bg-slate-800 text-white" />
            <button type="button" onClick={handlePersonalize} className="ml-2 px-3 py-1 bg-cyan-600 rounded text-white">Personalize</button>
          </div>
          {personalized && (
            <div className="mb-4 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
              <h3 className="font-medium">Local suggestion</h3>
              <div className="whitespace-pre-wrap">{typeof personalized.local === 'string' ? personalized.local : JSON.stringify(personalized.local, null, 2)}</div>
              <h3 className="font-medium mt-2">AI narrative</h3>
              <div className="whitespace-pre-wrap">{personalized.narrative}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'projection' && (
        <div>
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Projection horizon (months)</label>
              <input type="number" min={1} max={120} value={projectionMonths} onChange={(e)=>setProjectionMonths(Number(e.target.value))} className="w-32 px-2 py-1 rounded bg-slate-800 text-white" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleProjectOneYear} className="px-3 py-2 bg-slate-700 rounded text-white">Use built-in 1-year</button>
              <button type="button" onClick={async ()=>{
                        try{
                          setLoading(true);
                          const today = new Date().toISOString().slice(0,10);
                          const spending = await getSpendingForDay(today);
                          const timeUse = await getTimeUseForDay(today);
                          const habits = await listHabits();
                          const goals = await listGoals();
                          const reflections = await getReflectionsBetween(today, today);
                          const resilience = await listResilience(5);
                          const momentum = await getMomentumTrend(7);
                          const data = { meta: { horizon_months: projectionMonths }, spending, timeUse, habits, goals, reflections, resilience, momentum, summary };
                          const cfg = await currentAIConfig();
                          const response = await fetch('/api/agent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'predict', provider: cfg.provider, api_key: cfg.api_key, model: cfg.model, temperature: 0.3, activity_data: data }) });
                          const result = await response.json();
                          setProjection({ aiNarrative: result.text || JSON.stringify(result) });
                        } finally { setLoading(false); }
              }} className="px-3 py-2 bg-indigo-600 rounded text-white">Project horizon</button>
            </div>
          </div>
          {userProjection && (
            <div className="mb-3 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">User projection (override)</h4>
                  <div className="text-xs text-slate-300">{userProjection}</div>
                </div>
                <div>
                  <button type="button" onClick={() => { if (!navigator.onLine) return alert('Must be online to edit'); setShowSettings(true); }} className="px-2 py-1 bg-slate-700 rounded text-white text-sm">Edit</button>
                </div>
              </div>
            </div>
          )}
          {projection && (
            <div className="mb-4 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
              <h3 className="font-medium">Deterministic summary</h3>
              <div className="whitespace-pre-wrap text-xs">{projection.deterministic ? Object.entries(projection.deterministic).map(([k,v]) => (<div key={k}><strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>)) : <div>No deterministic summary available</div>}</div>
              <h3 className="font-medium mt-2">AI forecast</h3>
              <div className="whitespace-pre-wrap">{projection.aiNarrative}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div>
          <div className="mb-3 max-h-96 overflow-y-auto space-y-2 p-2 bg-slate-900/40 rounded">
            {(messages || []).map((m: any) => (
              <div key={m.id} className={`p-2 rounded ${m.role === 'user' ? 'bg-cyan-600/20' : 'bg-slate-800/60'}`}>
                <div className="text-xs text-slate-400">{m.role}</div>
                <div className="whitespace-pre-wrap text-slate-200 text-sm">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} placeholder="Ask anything..." className="flex-1 px-3 py-2 rounded bg-slate-800 text-white" />
            <button type="button" onClick={handleAsk} className="px-3 py-2 bg-cyan-600 rounded text-white">{loading ? '...' : 'Send'}</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <AISettings onClose={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}
