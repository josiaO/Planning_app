import { useEffect, useState } from 'react';
import { usePlans } from '../contexts/PlansContext';

export default function Reflection(){
  const { addReflection, getReflectionsBetween, addResilience, listResilience } = usePlans() as any;
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [tags, setTags] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);

  // Resilience log
  const [setback, setSetback] = useState('');
  const [reframe, setReframe] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [resilience, setResilience] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const start = new Date(date);
      start.setDate(start.getDate() - 6);
      const startISO = start.toISOString().slice(0,10);
      const endISO = date;
      const list = await getReflectionsBetween(startISO, endISO);
      setEntries(list || []);
      const res = await listResilience(20);
      setResilience(res || []);
    })();
  }, [date]);

  const saveReflection = async () => {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    await addReflection({ date, q_energized: q1, q_alignment: q2, q_constraint_learning: q3, tags: tagList });
    setQ1(''); setQ2(''); setQ3(''); setTags('');
    const start = new Date(date); start.setDate(start.getDate() - 6);
    const list = await getReflectionsBetween(start.toISOString().slice(0,10), date);
    setEntries(list || []);
  };

  const saveResilience = async () => {
    if (!setback.trim() || !reframe.trim()) return;
    await addResilience({ date, setback, reframe, next_step: nextStep, tags: [] });
    setSetback(''); setReframe(''); setNextStep('');
    const res = await listResilience(20);
    setResilience(res || []);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Reflection</h1>
        <p className="text-slate-400">Build awareness and emotional discipline</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-slate-300">Date</label>
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="px-2 py-1 rounded bg-slate-800/50 text-white" />
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">What energized me today?</label>
            <textarea value={q1} onChange={(e)=>setQ1(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Did I act in alignment with my values?</label>
            <textarea value={q2} onChange={(e)=>setQ2(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">What did I learn from today’s constraints?</label>
            <textarea value={q3} onChange={(e)=>setQ3(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Tags (comma-separated)</label>
            <input value={tags} onChange={(e)=>setTags(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={saveReflection} className="px-3 py-2 bg-cyan-600 rounded text-white">Save</button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Last 7 days</h2>
        <div className="space-y-3">
          {entries.map((r:any)=> (
            <div key={r.id} className="p-3 bg-slate-800/50 rounded">
              <div className="text-xs text-slate-400 mb-1">{r.date}</div>
              <div className="text-slate-200 text-sm whitespace-pre-wrap">{r.q_energized || r.q_alignment || r.q_constraint_learning ? `${r.q_energized || ''}\n${r.q_alignment || ''}\n${r.q_constraint_learning || ''}` : '(no text)'}
              </div>
              {r.tags && r.tags.length>0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {r.tags.map((t:string, i:number)=> <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-700 rounded text-slate-200">#{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Resilience Log</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Setback Description</label>
            <textarea value={setback} onChange={(e)=>setSetback(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" rows={2} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Reframe Insight</label>
            <textarea value={reframe} onChange={(e)=>setReframe(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" rows={2} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Next Step</label>
            <input value={nextStep} onChange={(e)=>setNextStep(e.target.value)} className="w-full p-2 rounded bg-slate-800 text-white" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={saveResilience} className="px-3 py-2 bg-emerald-600 rounded text-white">Add Entry</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {resilience.map((r:any)=> (
            <div key={r.id} className="p-3 bg-slate-800/50 rounded">
              <div className="text-xs text-slate-400 mb-1">{r.date}</div>
              <div className="text-slate-200 text-sm">
                <div><span className="text-slate-400">Setback:</span> {r.setback}</div>
                <div><span className="text-slate-400">Reframe:</span> {r.reframe}</div>
                <div><span className="text-slate-400">Next:</span> {r.next_step}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}









