import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlansContext';
import { DollarSign, TrendingUp, TrendingDown, Plus } from 'lucide-react';

export function Budget() {
  const { user } = useAuth();
  const { plans, budgetLogs, loading, addBudgetLog, refresh, deleteBudgetLog, exportBudgetLogs, updateBudgetLog, addSpending, getSpendingForDay, addTimeUse, getTimeUseForDay, deleteSpending, deleteTimeUse, categoryCaps, setCategoryCap, removeCategoryCap, getOverCapAlerts, recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, listGoals } = usePlans() as any;
  const [showAddLog, setShowAddLog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [logAmount, setLogAmount] = useState(0);
  const [logDescription, setLogDescription] = useState('');
  const [logDate, setLogDate] = useState('');
  const [logType, setLogType] = useState('expense');
  const [editingLog, setEditingLog] = useState<any>(null);
  // Spending & Time-use state
  const [spendingDate, setSpendingDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [spendingEntries, setSpendingEntries] = useState<any[]>([]);
  const [spendingAmount, setSpendingAmount] = useState<number>(0);
  const [spendingDesc, setSpendingDesc] = useState<string>('');
  const [spendingGoal, setSpendingGoal] = useState<string>('');
  const [allGoals, setAllGoals] = useState<any[]>([]);

  const [timeDate, setTimeDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [timeStart, setTimeStart] = useState<string>('');
  const [timeEnd, setTimeEnd] = useState<string>('');
  const [timeDesc, setTimeDesc] = useState<string>('');
  const [timeGoal, setTimeGoal] = useState<string>('');
  // Caps state
  const [newCapCategory, setNewCapCategory] = useState('');
  const [newCapAmount, setNewCapAmount] = useState<number>(0);
  const [capAlerts, setCapAlerts] = useState<any[]>([]);
  // Recurring state
  const [recDesc, setRecDesc] = useState('');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recCategory, setRecCategory] = useState('');
  const [recFrequency, setRecFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [recStartDate, setRecStartDate] = useState<string>(new Date().toISOString().slice(0,10));

  useEffect(() => {
    refresh();
    // load today's spending/time-use
    (async () => {
      const s = await getSpendingForDay(spendingDate);
      setSpendingEntries(s || []);
      const t = await getTimeUseForDay(timeDate);
      setTimeEntries(t || []);
      const alerts = await getOverCapAlerts();
      setCapAlerts(alerts || []);
      try{ const goals = await listGoals(); setAllGoals(goals||[]);}catch(e){}
    })();
  }, [user]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPlan) return;
    // Use local context to add budget log and update plan
    await addBudgetLog({ user_id: user.id, plan_id: selectedPlan, amount: logAmount, description: logDescription, date: logDate || new Date().toISOString(), type: logType });
    setShowAddLog(false);
    setSelectedPlan('');
    setLogAmount(0);
    setLogDescription('');
    setLogDate('');
    setLogType('expense');
    refresh();
  };

  const totalPlanned = (plans as any[]).reduce((acc: number, p: any) => acc + Number(p.budget_planned), 0);
  const totalSpent = (plans as any[]).reduce((acc: number, p: any) => acc + Number(p.budget_spent), 0);
  const difference = totalPlanned - totalSpent;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Budget Control</h1>
          <p className="text-slate-400">Track and manage your financial resources</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddLog(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-5 h-5" />
            Log Expense
          </button>
          <button type="button" onClick={async () => {
            const { budgetLogsToCSV, downloadCSV } = await import('../lib/export');
            const logs = await exportBudgetLogs();
            const csv = budgetLogsToCSV(logs as any[]);
            downloadCSV(csv, `budget-logs-${new Date().toISOString()}.csv`);
          }} className="px-4 py-2 bg-slate-800/50 rounded-md text-white">Export Logs</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">${totalPlanned.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Planned</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">${totalSpent.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Spent</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 bg-gradient-to-br ${difference >= 0 ? 'from-green-500 to-emerald-500' : 'from-red-500 to-orange-500'} rounded-lg flex items-center justify-center shadow-lg`}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">${Math.abs(difference).toLocaleString()}</p>
          <p className="text-slate-400 text-sm">{difference >= 0 ? 'Remaining' : 'Over Budget'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Plan Budgets</h2>
          <div className="space-y-4">
            {(plans as any[]).map((plan: any) => {
              const spent = Number(plan.budget_spent);
              const planned = Number(plan.budget_planned);
              const percentage = planned > 0 ? (spent / planned) * 100 : 0;

              return (
                <div key={plan.id} className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{plan.title}</h3>
                      <p className="text-sm text-slate-400">{plan.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">${spent.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">of ${planned.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        percentage > 100
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : percentage > 80
                          ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{percentage.toFixed(1)}% used</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {(budgetLogs as any[]).map((log: any) => {
              const plan = (plans as any[]).find((p: any) => p.id === log.plan_id);
              return (
                <div key={log.id} className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{log.description || 'Expense'}</p>
                    <p className="text-sm text-slate-400 truncate">{plan?.title || 'Unknown Plan'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-bold">${Number(log.amount).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-500">{log.type || 'expense'}</p>
                    <div className="flex flex-col items-end">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingLog(log)} className="text-xs text-cyan-400 hover:text-cyan-300">Edit</button>
                                    <button type="button" onClick={() => {
                          if (!confirm('Delete this log? This will adjust the plan budget.')) return;
                          deleteBudgetLog(log.id);
                        }} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Category Caps</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <input value={newCapCategory} onChange={(e) => setNewCapCategory(e.target.value)} placeholder="Category (e.g., Food)" className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            <input type="number" value={newCapAmount} onChange={(e) => setNewCapAmount(Number(e.target.value))} placeholder="Monthly cap" className="w-40 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            <button type="button" onClick={async () => { if (!newCapCategory || !newCapAmount) return; await setCategoryCap(newCapCategory, newCapAmount); setNewCapCategory(''); setNewCapAmount(0); const alerts = await getOverCapAlerts(); setCapAlerts(alerts || []); }} className="px-3 py-2 bg-cyan-600 rounded text-white">Save</button>
          </div>
          <div className="space-y-2">
            {(categoryCaps || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                <div className="text-slate-200 text-sm">{c.category}</div>
                <div className="text-slate-200 text-sm">${Number(c.monthly_cap).toLocaleString()}</div>
                <button type="button" onClick={async () => { await removeCategoryCap(c.category); const alerts = await getOverCapAlerts(); setCapAlerts(alerts || []); }} className="text-xs text-red-400">Remove</button>
              </div>
            ))}
          </div>
          {capAlerts.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-300 text-sm mb-2">Alerts (≥80% of cap this month)</p>
              <ul className="space-y-2">
                {capAlerts.map((a: any) => (
                  <li key={a.category} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                    <span className="text-white text-sm">{a.category}</span>
                    <span className="text-xs text-orange-400">${a.spent.toLocaleString()} / ${a.cap.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Recurring Expenses</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input value={recDesc} onChange={(e) => setRecDesc(e.target.value)} placeholder="Description" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            <input type="number" value={recAmount} onChange={(e) => setRecAmount(Number(e.target.value))} placeholder="Amount" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            <input value={recCategory} onChange={(e) => setRecCategory(e.target.value)} placeholder="Category (optional)" className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            <select value={recFrequency} onChange={(e) => setRecFrequency(e.target.value as any)} className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input type="date" value={recStartDate} onChange={(e) => setRecStartDate(e.target.value)} className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
          </div>
          <div className="mb-4">
            <button type="button" onClick={async () => {
              if (!recDesc || !recAmount) return;
              const nextRun = recStartDate || new Date().toISOString().slice(0,10);
              await addRecurringExpense({ amount: recAmount, description: recDesc, currency: 'TZS', frequency: recFrequency, start_date: recStartDate, next_run_date: nextRun, category: recCategory || undefined });
              setRecDesc(''); setRecAmount(0); setRecCategory(''); setRecFrequency('monthly'); setRecStartDate(new Date().toISOString().slice(0,10));
            }} className="px-3 py-2 bg-cyan-600 rounded text-white">Add</button>
          </div>
          <div className="space-y-2">
            {(recurringExpenses || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                <div className="text-slate-200 text-sm truncate mr-2">{r.description}</div>
                <div className="text-slate-200 text-xs">{r.frequency} • next {r.next_run_date}</div>
                <div className="text-slate-200 text-sm">{Number(r.amount).toLocaleString()}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={async () => { const d = prompt('Update next run date (YYYY-MM-DD)', r.next_run_date) || r.next_run_date; await updateRecurringExpense(r.id, { next_run_date: d }); }} className="text-xs text-cyan-400">Schedule</button>
                  <button type="button" onClick={async () => { if (!confirm('Delete recurring expense?')) return; await deleteRecurringExpense(r.id); }} className="text-xs text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Quick Add Spending</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Date</label>
              <input type="date" value={spendingDate} onChange={(e) => setSpendingDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Amount</label>
              <input type="number" value={spendingAmount} onChange={(e) => setSpendingAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Description</label>
              <input type="text" value={spendingDesc} onChange={(e) => setSpendingDesc(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Link to Goal (optional)</label>
              <select value={spendingGoal} onChange={(e)=>setSpendingGoal(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white">
                <option value="">No goal</option>
                {allGoals.map((g:any)=> <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={async () => {
                if (!spendingAmount) return alert('Enter an amount');
                await addSpending({ amount: spendingAmount, datetime: `${spendingDate}T00:00:00.000Z`, description: spendingDesc, goal_id: spendingGoal } as any);
                const s = await getSpendingForDay(spendingDate);
                setSpendingEntries(s || []);
                setSpendingAmount(0); setSpendingDesc('');
                setSpendingGoal('');
              }} className="px-3 py-2 bg-cyan-500 rounded-md text-white">Add</button>
              <button type="button" onClick={async () => {
                const s = await getSpendingForDay(spendingDate);
                setSpendingEntries(s || []);
              }} className="px-3 py-2 bg-slate-800/50 rounded-md text-white">Refresh</button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Today's Spending</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <input type="date" value={spendingDate} onChange={async (e) => { setSpendingDate(e.target.value); const s = await getSpendingForDay(e.target.value); setSpendingEntries(s || []); }} className="px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-md text-white" />
            </div>
            {(spendingEntries || []).length === 0 && <p className="text-slate-400">No spending for this day.</p>}
            {(spendingEntries || []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-md">
                <div>
                  <div className="text-white font-semibold">{s.description || 'Spending'}</div>
                  <div className="text-xs text-slate-400">{new Date(s.datetime).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{Number(s.amount).toLocaleString()}</div>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={async () => {
                      if (!confirm('Delete this spending entry?')) return;
                      await deleteSpending(s.id);
                      const refreshed = await getSpendingForDay(spendingDate);
                      setSpendingEntries(refreshed || []);
                    }} className="text-xs text-red-400">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Time Use Tracker</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Date</label>
              <input type="date" value={timeDate} onChange={(e) => setTimeDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Description</label>
              <input type="text" value={timeDesc} onChange={(e) => setTimeDesc(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Link to Goal (optional)</label>
              <select value={timeGoal} onChange={(e)=>setTimeGoal(e.target.value)} className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white">
                <option value="">No goal</option>
                {allGoals.map((g:any)=> <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={async () => {
                if (!timeStart) return alert('Choose a start time');
                const startISO = `${timeDate}T${timeStart}:00.000Z`;
                const endISO = timeEnd ? `${timeDate}T${timeEnd}:00.000Z` : undefined;
                await addTimeUse({ start: startISO, end: endISO, description: timeDesc, goal_id: timeGoal } as any);
                const t = await getTimeUseForDay(timeDate);
                setTimeEntries(t || []);
                setTimeStart(''); setTimeEnd(''); setTimeDesc('');
                setTimeGoal('');
              }} className="px-3 py-2 bg-cyan-500 rounded-md text-white">Add</button>
              <button type="button" onClick={async () => { const t = await getTimeUseForDay(timeDate); setTimeEntries(t || []); }} className="px-3 py-2 bg-slate-800/50 rounded-md text-white">Refresh</button>
            </div>

            <div className="mt-3">
              {(timeEntries || []).length === 0 && <p className="text-slate-400">No time entries for this day.</p>}
              {(timeEntries || []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-md mb-2">
                  <div>
                    <div className="text-white font-semibold">{t.description || 'Time Entry'}</div>
                    <div className="text-xs text-slate-400">{t.start ? new Date(t.start).toLocaleTimeString() : ''} - {t.end ? new Date(t.end).toLocaleTimeString() : '...'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">{t.duration_minutes ? `${t.duration_minutes} min` : ''}</div>
                    <div className="flex gap-2 mt-1">
                      <button type="button" onClick={async () => {
                        if (!confirm('Delete this time entry?')) return;
                        await deleteTimeUse(t.id);
                        const refreshed = await getTimeUseForDay(timeDate);
                        setTimeEntries(refreshed || []);
                      }} className="text-xs text-red-400">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={async () => {
          const { combinedSpendingTimeZIP } = await import('../lib/export');
          const s = await getSpendingForDay(spendingDate);
          const t = await getTimeUseForDay(timeDate);
          await combinedSpendingTimeZIP(s || [], t || []);
        }} className="px-4 py-2 bg-slate-800/50 rounded-md text-white">Download Spending & Time (ZIP)</button>
      </div>

      {showAddLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white">Log Expense</h2>
            </div>
            <form onSubmit={handleAddLog} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Plan</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                >
                  <option value="">Select a plan</option>
                    {(plans as any[]).map((plan: any) => (
                    <option key={plan.id} value={plan.id}>{plan.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                <input
                  type="number"
                  value={logAmount}
                  onChange={(e) => setLogAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <input
                  type="text"
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="What was this for?"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                <select value={logType} onChange={(e) => setLogType(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white">
                  <option value="expense">Expense</option>
                  <option value="refund">Refund</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="flex-1 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

          {editingLog && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Edit Log</h2>
                  <button type="button" onClick={() => setEditingLog(null)} className="text-slate-400">Close</button>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  await updateBudgetLog(editingLog.id, { amount: Number(editingLog.amount), description: editingLog.description, date: editingLog.date, type: editingLog.type });
                  setEditingLog(null);
                  refresh();
                }} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Amount</label>
                    <input type="number" value={editingLog.amount} onChange={(e) => setEditingLog({ ...editingLog, amount: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Description</label>
                    <input type="text" value={editingLog.description} onChange={(e) => setEditingLog({ ...editingLog, description: e.target.value })} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Date</label>
                    <input type="date" value={editingLog.date?.split('T')[0]} onChange={(e) => setEditingLog({ ...editingLog, date: e.target.value })} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Type</label>
                    <select value={editingLog.type} onChange={(e) => setEditingLog({ ...editingLog, type: e.target.value })} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white">
                      <option value="expense">Expense</option>
                      <option value="refund">Refund</option>
                      <option value="transfer">Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditingLog(null)} className="flex-1 px-4 py-2 text-slate-400 bg-slate-800/50 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-cyan-500 rounded-lg text-white">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
    </div>
  );
}
