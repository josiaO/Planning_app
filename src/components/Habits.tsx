import { useEffect, useState } from 'react';
import { usePlans } from '../contexts/PlansContext';

export default function Habits(){
  const { addHabit, deleteHabit, listHabits, setHabitChecked, getHabitStreak } = usePlans() as any;
  const [habits, setHabits] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [today, setToday] = useState<string>(new Date().toISOString().slice(0,10));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  useEffect(()=>{ (async()=>{ const list = await listHabits(); setHabits(list); const s:Record<string,number> = {}; for(const h of list){ s[h.id] = await getHabitStreak(h.id);} setStreaks(s); })(); },[]);

  const add = async () => {
    if (!title.trim()) return;
    await addHabit({ title, description: desc });
    setTitle(''); setDesc('');
    const list = await listHabits();
    setHabits(list);
  };

  const toggle = async (habitId: string) => {
    const next = !checked[habitId];
    setChecked({ ...checked, [habitId]: next });
    await setHabitChecked(habitId, today, next);
    const k = await getHabitStreak(habitId);
    setStreaks({ ...streaks, [habitId]: k });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Habits</h1>
        <p className="text-slate-400">Micro-habits for consistent progress</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Habit title" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white" />
          <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Description (optional)" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white" />
          <button type="button" onClick={add} className="px-3 py-2 bg-cyan-600 rounded text-white">Add</button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-slate-300">Date</label>
          <input type="date" value={today} onChange={(e)=>setToday(e.target.value)} className="px-2 py-1 rounded bg-slate-800/50 text-white" />
        </div>
        <div className="space-y-2">
          {habits.map((h:any)=> (
            <div key={h.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
              <label className="flex items-center gap-2 text-slate-200">
                <input type="checkbox" checked={!!checked[h.id]} onChange={()=>toggle(h.id)} />
                {h.title}
              </label>
              <div className="text-xs text-slate-400">Streak: {streaks[h.id] || 0}</div>
              <button type="button" onClick={async ()=>{ if(!confirm('Delete habit?')) return; await deleteHabit(h.id); setHabits(await listHabits()); }} className="text-xs text-red-400">Delete</button>
            </div>
          ))}
          {habits.length===0 && <div className="text-slate-400 text-sm">No habits yet.</div>}
        </div>
      </div>
    </div>
  );
}



