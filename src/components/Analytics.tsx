import { useEffect, useState } from 'react';
import { usePlans } from '../contexts/PlansContext';

export function Analytics() {
  const { getSpendingForDay, getTimeUseForDay, getMonthlySpendingSeries, getWeeklyFocusSeries } = usePlans() as any;
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [spending, setSpending] = useState<any[]>([]);
  const [timeUse, setTimeUse] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const s = await getSpendingForDay(date);
      const t = await getTimeUseForDay(date);
      setSpending(s || []);
      setTimeUse(t || []);
    })();
  }, [date]);

  useEffect(() => {
    (async () => {
      const m = await getMonthlySpendingSeries(6);
      const w = await getWeeklyFocusSeries(8);
      setMonthly(m || []);
      setWeekly(w || []);
    })();
  }, []);

  const totalSpent = spending.reduce((a: number, e: any) => a + Number(e.amount), 0);
  const totalMinutes = timeUse.reduce((a: number, e: any) => a + (e.duration_minutes || 0), 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Analytics</h1>
      <div className="mb-4">
        <label className="text-sm text-slate-300">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-2 px-2 py-1 rounded bg-slate-800/50 text-white" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-4 rounded">
          <h2 className="text-lg font-semibold text-white">Spending</h2>
          <p className="text-white text-3xl font-bold mt-2">${totalSpent.toLocaleString()}</p>
          <p className="text-slate-400">Entries: {spending.length}</p>
          <div className="mt-4">
            <h3 className="text-sm text-slate-300 mb-2">Monthly (last 6)</h3>
            <div className="space-y-2">
              {monthly.map((m: any) => (
                <div key={m.month} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-slate-400">{m.month}</div>
                  <div className="flex-1 h-2 bg-slate-800 rounded">
                    <div className="h-2 bg-cyan-600 rounded" style={{ width: `${Math.min(100, m.total === 0 ? 0 : (m.total / Math.max(1, Math.max(...monthly.map((x:any)=>x.total)))) * 100)}%` }} />
                  </div>
                  <div className="w-24 text-right text-xs text-slate-300">${m.total.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded">
          <h2 className="text-lg font-semibold text-white">Time Use</h2>
          <p className="text-white text-3xl font-bold mt-2">{Math.round(totalMinutes/60)}h {totalMinutes%60}m</p>
          <p className="text-slate-400">Entries: {timeUse.length}</p>
          <div className="mt-4">
            <h3 className="text-sm text-slate-300 mb-2">Weekly Focus (last 8)</h3>
            <div className="space-y-2">
              {weekly.map((w: any) => (
                <div key={w.week} className="flex items-center gap-2">
                  <div className="w-24 text-xs text-slate-400 truncate">{w.week}</div>
                  <div className="flex-1 h-2 bg-slate-800 rounded">
                    <div className="h-2 bg-emerald-600 rounded" style={{ width: `${Math.min(100, w.totalMinutes === 0 ? 0 : (w.totalMinutes / Math.max(1, Math.max(...weekly.map((x:any)=>x.totalMinutes)))) * 100)}%` }} />
                  </div>
                  <div className="w-20 text-right text-xs text-slate-300">{Math.round(w.totalMinutes/60)}h</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
