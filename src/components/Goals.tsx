import { useEffect, useState } from 'react';
import { usePlans } from '../contexts/PlansContext';

export default function Goals(){
  const { listGoals, addGoal, updateGoal, deleteGoal } = usePlans() as any;
  const [goals, setGoals] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');

  useEffect(()=>{ (async()=>{ setGoals(await listGoals()); })(); },[]);

  const create = async () => {
    if (!title.trim()) return;
    await addGoal({ title, description: desc, category: cat });
    setTitle(''); setDesc(''); setCat('');
    setGoals(await listGoals());
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    await deleteGoal(id);
    setGoals(await listGoals());
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Goals</h1>
        <p className="text-slate-400">Define and track long-term goals</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white" />
          <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Description" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white" />
            <div className="flex gap-2">
            <input value={cat} onChange={(e)=>setCat(e.target.value)} placeholder="Category" className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white" />
            <button type="button" onClick={create} className="px-3 py-2 bg-cyan-600 rounded text-white">Add</button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {goals.map((g:any)=> (
          <div key={g.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">{g.title}</div>
              <div className="flex gap-2">
                <button type="button" onClick={async ()=>{
                  const nt = prompt('Update title', g.title) || g.title;
                  const nd = prompt('Update description', g.description||'') || g.description;
                  const nc = prompt('Update category', g.category||'') || g.category;
                  await updateGoal(g.id, { title: nt, description: nd, category: nc });
                  setGoals(await listGoals());
                }} className="text-xs text-cyan-400">Edit</button>
                <button type="button" onClick={()=>remove(g.id)} className="text-xs text-red-400">Delete</button>
              </div>
            </div>
            {g.description && <div className="text-slate-400 text-sm">{g.description}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}



