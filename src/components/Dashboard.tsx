import { useEffect, useMemo, useState } from 'react';
import { Plan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlansContext';
import { TrendingUp, Target, Zap, DollarSign, Calendar, Layers } from 'lucide-react';
import db from '../lib/db';

type DashboardProps = {
  onEditPlan: (plan: Plan) => void;
};

export function Dashboard({ onEditPlan }: DashboardProps) {
  const { user } = useAuth();
  const { plans, loading, refresh, getSpendingForDay, getTimeUseForDay, setMomentumRating, getMomentumTrend } = usePlans() as any;
  const [todaySpending, setTodaySpending] = useState<any[]>([]);
  const [todayTime, setTodayTime] = useState<any[]>([]);
  const [momentum, setMomentum] = useState<number>(0);
  const [trend, setTrend] = useState<Array<{date:string;rating:number}>>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [counts, setCounts] = useState({ highlights: 0, reflections: 0, flashcards: 0 });
  const todayKey = new Date().toISOString().slice(0,10);

  useEffect(() => {
    // refresh when user changes
    refresh();
    (async () => {
      const s = await getSpendingForDay(todayKey);
      const t = await getTimeUseForDay(todayKey);
      setTodaySpending(s || []);
      setTodayTime(t || []);
      try{ const tr = await getMomentumTrend(7); setTrend(tr || []); const today = tr?.find((x:any)=>x.date===todayKey); setMomentum(today?.rating || 0);}catch(e){}
      try {
        const h = await db.history.orderBy('created_at').reverse().limit(20).toArray();
        setRecentActivity(h as any);
        const [hl, rf, fc] = await Promise.all([db.highlights.count(), db.reflections.count(), db.flashcards.count()]);
        setCounts({ highlights: hl, reflections: rf, flashcards: fc });
      } catch (e) {}
    })();
  }, [user]);

  const stats = {
    totalPlans: plans.length,
  avgProgress: (plans as any[]).length > 0 ? Math.round((plans as any[]).reduce((acc: number, p: any) => acc + p.progress, 0) / (plans as any[]).length) : 0,
  totalBudget: (plans as any[]).reduce((acc: number, p: any) => acc + Number(p.budget_planned), 0),
  totalSpent: (plans as any[]).reduce((acc: number, p: any) => acc + Number(p.budget_spent), 0),
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'Vision': return 'from-purple-500 to-pink-500';
      case 'Strategy': return 'from-cyan-500 to-blue-500';
      case 'Tactic': return 'from-green-500 to-emerald-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'Vision': return Target;
      case 'Strategy': return TrendingUp;
      case 'Tactic': return Zap;
      default: return Layers;
    }
  };

  // Derived: Today's focus and watchlist
  const focus = useMemo(() => {
    const totalMinutes = (todayTime || []).reduce((a: number, e: any) => a + (e.duration_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Due soon: plans ending within 7 days
    const dueSoon = (plans as any[]).filter(p => {
      const days = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 7 && p.status === 'active';
    }).slice(0, 3);
    return { hours, minutes, entries: (todayTime || []).length, dueSoon };
  }, [todayTime, plans]);

  const watchlist = useMemo(() => {
    const totalSpentToday = (todaySpending || []).reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    // Over 80% budget plans
    const risky = (plans as any[]).filter(p => Number(p.budget_planned) > 0 && (Number(p.budget_spent) / Number(p.budget_planned)) >= 0.8 && p.status === 'active').slice(0, 3);
    return { totalSpentToday, entries: (todaySpending || []).length, risky };
  }, [todaySpending, plans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Command Dashboard</h1>
        <p className="text-slate-400">Monitor your strategic initiatives and progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.totalPlans}</p>
          <p className="text-slate-400 text-sm">Active Plans</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-green-500/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/30">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.avgProgress}%</p>
          <p className="text-slate-400 text-sm">Avg Progress</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">${stats.totalBudget.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Budget</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-orange-500/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">${stats.totalSpent.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">Total Spent</p>
        </div>
        
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-purple-500/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{counts.highlights}</p>
          <p className="text-slate-400 text-sm">Highlights</p>
        </div>
      </div>

      {/* Today summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3">Momentum rating</h2>
          <div className="flex items-center gap-4">
            <input type="range" min="0" max="5" step="1" value={momentum} onChange={async (e)=>{ const v = Number(e.target.value); setMomentum(v); try{ await setMomentumRating(v, todayKey); const tr = await getMomentumTrend(7); setTrend(tr||[]);}catch(err){} }} className="flex-1" />
            <div className="text-2xl">{momentum >=4 ? '🚀' : momentum>=2 ? '😐' : '💤'}</div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-slate-300 mb-2">Last 7 days</div>
            <div className="flex items-end gap-2 h-20">
              {trend.map((d:any)=>{
                const h = (d.rating||0) * 16;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div className="w-6 bg-cyan-600 rounded" style={{ height: `${h}px` }} />
                    <div className="text-[10px] text-slate-400">{d.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3">Today's focus</h2>
          {/* Daily habits checklist (compact) */}
          <div className="mb-4 p-3 bg-slate-800/40 rounded">
            <div className="text-sm text-slate-300 mb-2">Today's micro‑habits</div>
            <a href="#" onClick={(e)=>{ e.preventDefault(); /* route to habits */ }} className="text-xs text-cyan-400">Open Habits</a>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-white">{focus.hours}h {focus.minutes}m</p>
              <p className="text-slate-400 text-sm">Focused time ({focus.entries} entries)</p>
            </div>
          </div>
          {focus.dueSoon.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-300 text-sm mb-2">Due within 7 days</p>
              <ul className="space-y-2">
                {focus.dueSoon.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                    <span className="text-white text-sm truncate mr-2">{p.title}</span>
                    <span className="text-xs text-slate-400">{Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)} days left</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3">Money watchlist</h2>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-white">${watchlist.totalSpentToday.toLocaleString()}</p>
              <p className="text-slate-400 text-sm">Spent today ({watchlist.entries} entries)</p>
            </div>
          </div>
          {watchlist.risky.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-300 text-sm mb-2">Plans at ≥80% of budget</p>
              <ul className="space-y-2">
                {watchlist.risky.map((p: any) => {
                  const pct = Math.round((Number(p.budget_spent) / Number(p.budget_planned)) * 100);
                  return (
                    <li key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                      <span className="text-white text-sm truncate mr-2">{p.title}</span>
                      <span className="text-xs text-orange-400 font-semibold">{pct}% used</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Active Plans</h2>
        {plans.length === 0 ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-12 text-center">
            <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No active plans yet</p>
            <p className="text-slate-500 text-sm mt-2">Create your first plan to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(plans as any[]).map((plan: any) => {
              const LayerIcon = getLayerIcon(plan.layer);
              const budgetRemaining = Number(plan.budget_planned) - Number(plan.budget_spent);
              const daysRemaining = Math.ceil((new Date(plan.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={plan.id}
                  onClick={() => onEditPlan(plan)}
                  className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 bg-gradient-to-br ${getLayerColor(plan.layer)} rounded-lg flex items-center justify-center shadow-lg`}>
                          <LayerIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{plan.layer}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{plan.title}</h3>
                      <p className="text-sm text-slate-400">{plan.category}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Progress</span>
                        <span className="text-sm font-semibold text-white">{plan.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getLayerColor(plan.layer)} transition-all duration-500`}
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500">Days Left</p>
                          <p className="text-sm font-semibold text-white">{daysRemaining > 0 ? daysRemaining : 'Overdue'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs text-slate-500">Budget Left</p>
                          <p className="text-sm font-semibold text-white">${budgetRemaining.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-white mb-4">Recent activity</h2>
        <div className="space-y-2">
          {recentActivity.map((a:any)=> (
            <div key={a.id} className="bg-slate-900/40 p-3 rounded flex items-start justify-between">
              <div>
                <div className="text-xs text-slate-400">{a.table_name} • {a.action}</div>
                <div className="text-sm text-white">{a.data?.text ? (a.data.text.slice(0,120)) : JSON.stringify(a.data).slice(0,120)}</div>
              </div>
              <div className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
