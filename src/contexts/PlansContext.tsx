import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db, PlanRecord, BudgetLogRecord, CategoryCapRecord, RecurringExpenseRecord, ReflectionRecord, ResilienceRecord, MomentumRecord, GoalRecord, HabitRecord } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { plansToCSV } from '../lib/export';
import { generateVerifier, generateCodeChallenge } from '../lib/pkce';
import { saveCloudToken, loadCloudToken } from '../lib/cloudTokens';

type PlansContextType = {
  plans: PlanRecord[];
  budgetLogs: BudgetLogRecord[];
  loading: boolean;
  addPlan: (p: Omit<PlanRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePlan: (id: string, patch: Partial<PlanRecord>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  addBudgetLog: (log: Omit<BudgetLogRecord, 'id' | 'created_at'> & { date?: string }) => Promise<void>;
  updateBudgetLog: (id: string, patch: Partial<BudgetLogRecord>) => Promise<void>;
  deleteBudgetLog: (id: string) => Promise<void>;
  exportBudgetLogs: () => Promise<BudgetLogRecord[]>;
  refresh: () => Promise<void>;
  purgeArchivedData: () => Promise<void>;
  historyEnabled: boolean;
  setHistoryEnabled: (enabled: boolean) => Promise<void>;
  exportCSV: (onlyHistory?: boolean) => Promise<string>;
  exportAllData: () => Promise<any>;
  importAllData: (payload: any) => Promise<void>;
  uploadToOneDrive: (filename?: string) => Promise<boolean>;
  uploadToGoogleDrive: (filename?: string) => Promise<boolean>;
  startOneDriveAuth?: () => Promise<void>;
  startGoogleAuth?: () => Promise<void>;
  handleOAuthCode?: (provider: 'onedrive' | 'gdrive', code: string) => Promise<boolean>;
  // tips by layer
  layerTips: Record<string, { title: string; description: string; example: string }>;
  // daily tracking
  addSpending: (s: { amount: number; currency?: string; datetime?: string; description?: string }) => Promise<void>;
  getSpendingForDay: (dateISO: string) => Promise<any[]>;
  addTimeUse: (t: { start: string; end?: string; description?: string; category?: string }) => Promise<void>;
  getTimeUseForDay: (dateISO: string) => Promise<any[]>;
  deleteSpending: (id: string) => Promise<void>;
  deleteTimeUse: (id: string) => Promise<void>;
  // budget caps
  categoryCaps: CategoryCapRecord[];
  setCategoryCap: (category: string, monthly_cap: number) => Promise<void>;
  removeCategoryCap: (category: string) => Promise<void>;
  getOverCapAlerts: (monthKey?: string) => Promise<{ category: string; cap: number; spent: number }[]>;
  // recurring expenses
  recurringExpenses: RecurringExpenseRecord[];
  addRecurringExpense: (r: Omit<RecurringExpenseRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateRecurringExpense: (id: string, patch: Partial<RecurringExpenseRecord>) => Promise<void>;
  deleteRecurringExpense: (id: string) => Promise<void>;
  // analytics helpers
  getMonthlySpendingSeries: (months?: number) => Promise<{ month: string; total: number }[]>;
  getWeeklyFocusSeries: (weeks?: number) => Promise<{ week: string; totalMinutes: number }[]>;
  // reflections & resilience
  addReflection: (r: { date?: string; q_energized?: string; q_alignment?: string; q_constraint_learning?: string; tags?: string[]; goal_id?: string; q_custom1?: string; q_custom2?: string }) => Promise<void>;
  getReflectionsBetween: (startISO: string, endISO: string) => Promise<ReflectionRecord[]>;
  addResilience: (r: { date?: string; setback: string; reframe: string; next_step: string; tags?: string[]; goal_id?: string }) => Promise<void>;
  listResilience: (limit?: number) => Promise<ResilienceRecord[]>;
  // momentum
  setMomentumRating: (rating: number, dateISO?: string) => Promise<void>;
  getMomentumTrend: (days?: number) => Promise<{ date: string; rating: number }[]>;
  // goals
  addGoal: (g: { title: string; description?: string; category?: string }) => Promise<GoalRecord>;
  updateGoal: (id: string, patch: Partial<GoalRecord>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  listGoals: () => Promise<GoalRecord[]>;
  // habits
  addHabit: (h: { title: string; description?: string }) => Promise<HabitRecord>;
  deleteHabit: (id: string) => Promise<void>;
  listHabits: () => Promise<HabitRecord[]>;
  setHabitChecked: (habitId: string, dateISO: string, checked: boolean) => Promise<void>;
  getHabitStreak: (habitId: string) => Promise<number>;
  // history
  addHistoryRecord: (tableName: string, recordId: string, action: 'create'|'update'|'delete', data: any) => Promise<void>;
  getHistoryRecords: (tableName?: string, limit?: number) => Promise<any[]>;
  clearHistoryRecords: (tableName?: string) => Promise<void>;
};

  
const PlansContext = createContext<PlansContextType | undefined>(undefined);

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [budgetLogs, setBudgetLogs] = useState<BudgetLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryCaps, setCategoryCaps] = useState<CategoryCapRecord[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseRecord[]>([]);
  // local caches for goals/habits are not needed separately; use db queries directly

  const loadAll = async () => {
    setLoading(true);
    const allPlans = await db.plans.orderBy('created_at').reverse().toArray();
    const logs = await db.budget_logs.orderBy('date').reverse().limit(200).toArray();
    const caps = await db.category_caps.toArray();
    const rec = await db.recurring_expenses.toArray();
    setPlans(allPlans);
    setBudgetLogs(logs);
    setCategoryCaps(caps);
    setRecurringExpenses(rec);
    // goals/habits available via db when needed
    setLoading(false);
  };

  // settings
  const [historyEnabled, setHistoryEnabledState] = useState<boolean>(true);

  const loadSettings = async () => {
    const s = await db.settings.get('historyEnabled');
    if (s && typeof s.value === 'boolean') setHistoryEnabledState(s.value);
  };

  useEffect(() => {
    loadAll();
    loadSettings();
    function onMessage(e: MessageEvent) {
      try {
        if (e.origin !== location.origin) return;
        const data = e.data as any;
        if (data?.type === 'oauth_callback' && data.provider && data.code) {
          // exchange code
          (async () => {
            try { await handleOAuthCode(data.provider, data.code); } catch (err) { console.error('OAuth handling failed', err); }
          })();
        }
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('message', onMessage);
    return () => { window.removeEventListener('message', onMessage); };
  }, []);

  const updateBudgetLog = async (id: string, patch: Partial<BudgetLogRecord>) => {
    // If amount changes, adjust the plan's budget_spent accordingly
    const old = await db.budget_logs.get(id);
    await db.budget_logs.update(id, patch as any);
    const updated = await db.budget_logs.get(id);
    if (old && updated && old.amount !== updated.amount) {
      const diff = Number(updated.amount) - Number(old.amount);
      const plan = await db.plans.get(updated.plan_id);
      if (plan) {
        await db.plans.update(plan.id, { budget_spent: Number(plan.budget_spent) + diff, updated_at: new Date().toISOString() } as any);
      }
    }
    await loadAll();
  };

  const exportBudgetLogs = async () => {
    const logs = await db.budget_logs.toArray();
    return logs;
  };

  const LAYER_TIPS = {
    Vision: {
      title: 'Vision Plan',
      description: 'Your ultimate long-term destination. Defines the legacy you want to leave and the future you want to create. Think big: 10-20 years ahead.',
      example: 'Build the biggest tech company in the world'
    },
    Strategy: {
      title: 'Strategic Plan',
      description: 'The major projects or milestones that move you toward your vision. These are the rockets you must build and launch within 2-5 years.',
      example: 'Launch a software startup or build an AI company'
    },
    Tactic: {
      title: 'Tactical Plan',
      description: 'The short-term actions and habits that push your strategy forward. These are the daily or weekly fuel burns that keep the momentum alive.',
      example: 'Code 2 hours a day or read 20 pages of an ML book this week'
    }
  } as const;

  // Spending / Time-use functions
  const addSpending = async (s: { amount: number; currency?: string; datetime?: string; description?: string }) => {
    const id = uuidv4();
    const datetime = s.datetime ?? new Date().toISOString();
    await db.spending.add({ id, user_id: undefined, amount: s.amount, currency: s.currency ?? 'TZS', datetime, description: s.description ?? '', goal_id: (s as any).goal_id });
    await loadAll();
  };

  const deleteSpending = async (id: string) => {
    await db.spending.delete(id);
    await loadAll();
  };

  const getSpendingForDay = async (dateISO: string) => {
    // filter by date (YYYY-MM-DD)
    const all = await db.spending.toArray();
    return all.filter((e: any) => e.datetime.startsWith(dateISO));
  };

  // Series helpers
  const getMonthlySpendingSeries = async (months = 6) => {
    const all = await db.spending.toArray();
    const byMonth = new Map<string, number>();
    for (const e of all) {
      const key = (e.datetime || '').slice(0,7);
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) || 0) + Number(e.amount || 0));
    }
    const keys = Array.from(byMonth.keys()).sort();
    const recent = keys.slice(-months);
    return recent.map(m => ({ month: m, total: byMonth.get(m) || 0 }));
  };

  const getWeeklyFocusSeries = async (weeks = 8) => {
    const all = await db.time_use.toArray();
    const byWeek = new Map<string, number>();
    function weekKey(d: Date) {
      const first = new Date(d.getFullYear(),0,1);
      const diff = Math.floor((d.getTime()-first.getTime())/86400000);
      const week = Math.floor((diff + first.getDay())/7);
      return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
    }
    for (const t of all) {
      const d = new Date(t.start);
      const key = weekKey(d);
      byWeek.set(key, (byWeek.get(key) || 0) + Number(t.duration_minutes || 0));
    }
    const keys = Array.from(byWeek.keys()).sort();
    const recent = keys.slice(-weeks);
    return recent.map(w => ({ week: w, totalMinutes: byWeek.get(w) || 0 }));
  };

  const addTimeUse = async (t: { start: string; end?: string; description?: string; category?: string }) => {
    const id = uuidv4();
    const duration_minutes = t.end ? Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / 60000) : undefined;
    await db.time_use.add({ id, user_id: undefined, start: t.start, end: t.end, duration_minutes, description: t.description ?? '', category: t.category ?? '', goal_id: (t as any).goal_id });
    await loadAll();
  };

  const getTimeUseForDay = async (dateISO: string) => {
    const all = await db.time_use.toArray();
    return all.filter((e: any) => e.start.startsWith(dateISO) || (e.end && e.end.startsWith(dateISO)));
  };

  const deleteTimeUse = async (id: string) => {
    await db.time_use.delete(id);
    await loadAll();
  };

  const addPlan = async (p: Omit<PlanRecord, 'id' | 'created_at' | 'updated_at'>) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.plans.add({ ...p, id, created_at: now, updated_at: now });
    await loadAll();
  };

  const updatePlan = async (id: string, patch: Partial<PlanRecord>) => {
    const now = new Date().toISOString();
    await db.plans.update(id, { ...patch, updated_at: now } as any);
    await loadAll();
  };

  const deletePlan = async (id: string) => {
    // soft-delete => mark archived unless history disabled then remove
    if (historyEnabled) {
      await db.plans.update(id, { status: 'archived', updated_at: new Date().toISOString() } as any);
    } else {
      await db.plans.delete(id);
    }
    await loadAll();
  };

  const addBudgetLog = async (log: Omit<BudgetLogRecord, 'id' | 'created_at'> & { date?: string }) => {
    const id = uuidv4();
    const date = (log as any).date ?? new Date().toISOString();
    const created_at = date;
    await db.budget_logs.add({ ...log, id, date, created_at });
    // update plan's budget_spent
    const plan = await db.plans.get(log.plan_id);
    if (plan) {
      await db.plans.update(plan.id, { budget_spent: Number(plan.budget_spent) + Number(log.amount), updated_at: new Date().toISOString() } as any);
    }
    await loadAll();
  };

  const deleteBudgetLog = async (id: string) => {
    const log = await db.budget_logs.get(id);
    if (log) {
      // subtract from plan's budget_spent
      const plan = await db.plans.get(log.plan_id);
      if (plan) {
        await db.plans.update(plan.id, { budget_spent: Number(plan.budget_spent) - Number(log.amount), updated_at: new Date().toISOString() } as any);
      }
      await db.budget_logs.delete(id);
      await loadAll();
    }
  };

  const refresh = async () => {
    await loadAll();
  };

  // Auto-backup when online and tokens exist
  useEffect(() => {
    let timer: any;
    async function tick() {
      try {
        if (navigator.onLine) {
          // Optional: auto-pull latest if a special setting is present (simple strategy: skip for now)
          const okOne = await uploadToOneDriveWithStoredToken(`mission-control-backup-${new Date().toISOString().slice(0,10)}.csv`);
          const okG = await uploadToGoogleDriveWithStoredToken(`mission-control-backup-${new Date().toISOString().slice(0,10)}.csv`);
          if (okOne || okG) {
            // mark timestamp of last backup
            await db.settings.put({ id: 'last_backup_at', key: 'last_backup_at', value: new Date().toISOString() });
          }
        }
      } catch (e) { /* ignore errors to avoid breaking UI */ }
    }
    // backup on mount and every 6 hours
    tick();
    timer = setInterval(tick, 6 * 60 * 60 * 1000);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // Recurring expense generation daily
  useEffect(() => {
    let timer: any;
    async function runRecurring() {
      try {
        const today = new Date().toISOString().slice(0,10);
        const recs = await db.recurring_expenses.toArray();
        for (const r of recs) {
          while (r.next_run_date && r.next_run_date <= today && (!r.end_date || r.next_run_date <= r.end_date)) {
            // generate spending entry for that date
            const id = uuidv4();
            const dt = `${r.next_run_date}T00:00:00.000Z`;
            await db.spending.add({ id, amount: r.amount, currency: r.currency || 'TZS', datetime: dt, description: r.description || '' });
            // advance next_run_date
            const d = new Date(r.next_run_date);
            if (r.frequency === 'daily') d.setDate(d.getDate() + 1);
            else if (r.frequency === 'weekly') d.setDate(d.getDate() + 7);
            else if (r.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
            r.next_run_date = d.toISOString().slice(0,10);
            await db.recurring_expenses.update(r.id, { next_run_date: r.next_run_date, updated_at: new Date().toISOString() } as any);
          }
        }
        await loadAll();
      } catch (e) { /* ignore */ }
    }
    // run on mount and every 24h
    runRecurring();
    timer = setInterval(runRecurring, 24 * 60 * 60 * 1000);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // Caps helpers
  const setCategoryCap = async (category: string, monthly_cap: number) => {
    const now = new Date().toISOString();
    const id = category.toLowerCase();
    await db.category_caps.put({ id, category, monthly_cap, updated_at: now, created_at: now } as any);
    await loadAll();
  };

  const removeCategoryCap = async (category: string) => {
    const id = category.toLowerCase();
    await db.category_caps.delete(id);
    await loadAll();
  };

  const getOverCapAlerts = async (monthKey?: string) => {
    const key = monthKey || new Date().toISOString().slice(0,7);
    const all = await db.spending.toArray();
    const byCat = new Map<string, number>();
    for (const e of all) {
      if (!e.datetime || !e.datetime.startsWith(key)) continue;
      // naive extraction from description prefix "[Category] desc" or fallback 'uncategorized'
      const match = (e.description || '').match(/^\[(.*?)\]/);
      const cat = match ? match[1] : 'uncategorized';
      byCat.set(cat, (byCat.get(cat) || 0) + Number(e.amount || 0));
    }
    const alerts: { category: string; cap: number; spent: number }[] = [];
    for (const cap of categoryCaps) {
      const spent = byCat.get(cap.category) || 0;
      if (cap.monthly_cap > 0 && spent >= cap.monthly_cap * 0.8) {
        alerts.push({ category: cap.category, cap: cap.monthly_cap, spent });
      }
    }
    return alerts.sort((a,b) => b.spent/b.cap - a.spent/b.cap);
  };

  // Recurring CRUD
  const addRecurringExpense = async (r: Omit<RecurringExpenseRecord, 'id' | 'created_at' | 'updated_at'>) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.recurring_expenses.add({ ...r, id, created_at: now, updated_at: now });
    await loadAll();
  };

  const updateRecurringExpense = async (id: string, patch: Partial<RecurringExpenseRecord>) => {
    await db.recurring_expenses.update(id, { ...patch, updated_at: new Date().toISOString() } as any);
    await loadAll();
  };

  const deleteRecurringExpense = async (id: string) => {
    await db.recurring_expenses.delete(id);
    await loadAll();
  };

  const purgeArchivedData = async () => {
    // remove archived and completed plans and budget logs older than a threshold (or all)
    const archived = await db.plans.where('status').anyOf(['archived', 'completed']).toArray();
    const ids = archived.map(p => p.id);
    await db.plans.bulkDelete(ids);
    // optionally clear budget logs that reference removed plans
    await db.budget_logs.where('plan_id').anyOf(ids).delete();
    await loadAll();
  };

  // Reflections & Resilience
  const addReflection = async (r: { date?: string; q_energized?: string; q_alignment?: string; q_constraint_learning?: string; tags?: string[]; goal_id?: string; q_custom1?: string; q_custom2?: string }) => {
    const id = uuidv4();
    const date = r.date ?? new Date().toISOString().slice(0,10);
    const created_at = new Date().toISOString();
    await (db as any).reflections.add({ id, date, ...r, created_at });
  };

  const getReflectionsBetween = async (startISO: string, endISO: string) => {
    const all = await (db as any).reflections.toArray();
    return (all as ReflectionRecord[]).filter(r => r.date >= startISO && r.date <= endISO);
  };

  const addResilience = async (r: { date?: string; setback: string; reframe: string; next_step: string; tags?: string[]; goal_id?: string }) => {
    const id = uuidv4();
    const date = r.date ?? new Date().toISOString().slice(0,10);
    const created_at = new Date().toISOString();
    await (db as any).resilience_logs.add({ id, date, ...r, created_at });
  };

  const listResilience = async (limit = 50) => {
    const all = await (db as any).resilience_logs.orderBy('date').reverse().limit(limit).toArray();
    return all as ResilienceRecord[];
  };

  // Momentum
  const setMomentumRating = async (rating: number, dateISO?: string) => {
    const date = dateISO ?? new Date().toISOString().slice(0,10);
    const id = `momentum-${date}`;
    const created_at = new Date().toISOString();
    await (db as any).momentum.put({ id, date, rating, created_at });
  };

  const getMomentumTrend = async (days = 7) => {
    const all = await (db as any).momentum.toArray();
    const map = new Map<string, number>();
    for (const m of all as MomentumRecord[]) map.set(m.date, m.rating);
    const out: { date: string; rating: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      out.push({ date: key, rating: map.get(key) ?? 0 });
    }
    return out;
  };

  // Goals
  const addGoal = async (g: { title: string; description?: string; category?: string }) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    await (db as any).goals.add({ id, ...g, created_at: now, updated_at: now });
    await loadAll();
    const rec = await db.goals.get(id);
    return (rec || { id, ...g }) as GoalRecord;
  };

  const updateGoal = async (id: string, patch: Partial<GoalRecord>) => {
    await (db as any).goals.update(id, { ...patch, updated_at: new Date().toISOString() });
    await loadAll();
  };

  const deleteGoal = async (id: string) => {
    await (db as any).goals.delete(id);
    await loadAll();
  };

  const listGoals = async () => {
    const all = await (db as any).goals.toArray();
    return all as GoalRecord[];
  };

  // Habits
  const addHabit = async (h: { title: string; description?: string }) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record = { id, ...h, created_at: now, updated_at: now };
    await (db as any).habits.add(record);
    await addHistoryRecord('habits', id, 'create', record);
    await loadAll();
    const rec = await (db as any).habits.get(id);
    return (rec || { id, ...h }) as HabitRecord;
  };

  const deleteHabit = async (id: string) => {
    const record = await (db as any).habits.get(id);
    await (db as any).habits.delete(id);
    await addHistoryRecord('habits', id, 'delete', record);
    // remove checks for this habit
    const all = await (db as any).habit_checks.where('habit_id').equals(id).toArray();
    const ids = all.map((x:any)=>x.id);
    if (ids.length) await (db as any).habit_checks.bulkDelete(ids);
    await loadAll();
  };

  const listHabits = async () => {
    const all = await (db as any).habits.toArray();
    return all as HabitRecord[];
  };

  const setHabitChecked = async (habitId: string, dateISO: string, checked: boolean) => {
    const id = `${habitId}-${dateISO}`;
    if (checked) {
      await (db as any).habit_checks.put({ id, habit_id: habitId, date: dateISO, created_at: new Date().toISOString() });
    } else {
      await (db as any).habit_checks.delete(id);
    }
  };

  const getHabitStreak = async (habitId: string) => {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const rec = await (db as any).habit_checks.get(`${habitId}-${key}`);
      if (rec) streak++; else break;
    }
    return streak;
  };

  // History tracking
  const addHistoryRecord = async (tableName: string, recordId: string, action: 'create'|'update'|'delete', data: any) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    await (db as any).history.add({ id, table_name: tableName, record_id: recordId, action, data, created_at: now });
  };

  const getHistoryRecords = async (tableName?: string, limit = 100) => {
    let query = (db as any).history.orderBy('created_at').reverse();
    if (tableName) query = query.filter((r: any) => r.table_name === tableName);
    return await query.limit(limit).toArray();
  };

  const clearHistoryRecords = async (tableName?: string) => {
    if (tableName) {
      await (db as any).history.where('table_name').equals(tableName).delete();
    } else {
      await (db as any).history.clear();
    }
  };

  const setHistoryEnabled = async (enabled: boolean) => {
    await db.settings.put({ id: 'historyEnabled', key: 'historyEnabled', value: enabled });
    setHistoryEnabledState(enabled);
  };

  const exportCSV = async (onlyHistory = false) => {
    const all = await db.plans.toArray();
    const rows = onlyHistory ? all.filter(p => p.status === 'archived' || p.status === 'completed') : all;
    const csv = plansToCSV(rows as any[]);
    return csv;
  };

  // Full export/import for cross-device sync
  const exportAllData = async () => {
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      plans: await db.plans.toArray(),
      budget_logs: await db.budget_logs.toArray(),
      spending: await db.spending.toArray(),
      time_use: await db.time_use.toArray(),
      goals: await (db as any).goals.toArray(),
      reflections: await (db as any).reflections.toArray(),
      resilience_logs: await (db as any).resilience_logs.toArray(),
      momentum: await (db as any).momentum.toArray(),
      habits: await (db as any).habits.toArray(),
      habit_checks: await (db as any).habit_checks.toArray(),
      category_caps: await db.category_caps.toArray(),
      recurring_expenses: await db.recurring_expenses.toArray(),
    };
    return payload;
  };

  const importAllData = async (payload: any) => {
    if (!payload) return;
    // naive replace strategy for now
  await (db as any).transaction('rw', [db.plans, db.budget_logs, db.spending, db.time_use, (db as any).goals, (db as any).reflections, (db as any).resilience_logs, (db as any).momentum, (db as any).habits, (db as any).habit_checks, db.category_caps, db.recurring_expenses], async () => {
      await db.plans.clear();
      await db.budget_logs.clear();
      await db.spending.clear();
      await db.time_use.clear();
      await (db as any).goals.clear();
      await (db as any).reflections.clear();
      await (db as any).resilience_logs.clear();
      await (db as any).momentum.clear();
      await (db as any).habits.clear();
      await (db as any).habit_checks.clear();
      await db.category_caps.clear();
      await db.recurring_expenses.clear();
      if (payload.plans?.length) await db.plans.bulkAdd(payload.plans);
      if (payload.budget_logs?.length) await db.budget_logs.bulkAdd(payload.budget_logs);
      if (payload.spending?.length) await db.spending.bulkAdd(payload.spending);
      if (payload.time_use?.length) await db.time_use.bulkAdd(payload.time_use);
      if (payload.goals?.length) await (db as any).goals.bulkAdd(payload.goals);
      if (payload.reflections?.length) await (db as any).reflections.bulkAdd(payload.reflections);
      if (payload.resilience_logs?.length) await (db as any).resilience_logs.bulkAdd(payload.resilience_logs);
      if (payload.momentum?.length) await (db as any).momentum.bulkAdd(payload.momentum);
      if (payload.habits?.length) await (db as any).habits.bulkAdd(payload.habits);
      if (payload.habit_checks?.length) await (db as any).habit_checks.bulkAdd(payload.habit_checks);
      if (payload.category_caps?.length) await db.category_caps.bulkAdd(payload.category_caps);
      if (payload.recurring_expenses?.length) await db.recurring_expenses.bulkAdd(payload.recurring_expenses);
    });
    await loadAll();
  };

  // Minimal upload helpers: token must be provided. These functions perform simple uploads.
  const uploadToOneDrive = async (token: string, filename = `mission-control-export-${new Date().toISOString()}.csv`) => {
    try {
      const csv = await exportCSV(false);
      const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(filename)}:/content`;
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' },
        body: csv,
      });
      return res.ok;
    } catch (e) {
      console.error('OneDrive upload failed', e);
      return false;
    }
  };

  // OAuth helpers for OneDrive and Google Drive
  const startOneDriveAuth = async () => {
    const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;
    if (!clientId) throw new Error('OneDrive client ID not configured (VITE_ONEDRIVE_CLIENT_ID)');
    const redirect = `${location.origin}/oauth-callback.html`;
    const verifier = generateVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('onedrive_pkce_verifier', verifier);
    const scope = encodeURIComponent('files.readwrite offline_access openid profile');
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&response_mode=query&scope=${scope}&code_challenge=${challenge}&code_challenge_method=S256`;
    window.open(url, '_blank', 'noopener');
  };

  const startGoogleAuth = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) throw new Error('Google client ID not configured (VITE_GOOGLE_CLIENT_ID)');
    
    const redirect = `${location.origin}/oauth-callback.html`;
    
    // For local development, use a simpler OAuth flow
    // Remove prompt=consent to avoid forcing re-authorization
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirect)}&access_type=offline`;
    
    window.open(url, '_blank', 'noopener');
  };

  // Exchange code (callback page will postMessage code back to opener). This function expects an object { provider, code }
  async function handleOAuthCode(provider: 'onedrive' | 'gdrive', code: string) {
    if (provider === 'onedrive') {
      const verifier = sessionStorage.getItem('onedrive_pkce_verifier') || '';
      const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;
      const redirect = `${location.origin}/oauth-callback.html`;
      const params = new URLSearchParams();
      params.append('client_id', clientId as string);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirect);
      params.append('code_verifier', verifier);
      const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      const data = await res.json();
      if (data.access_token) {
        const expires_at = Date.now() + (data.expires_in || 3600) * 1000;
        await saveCloudToken('onedrive', { provider: 'onedrive', access_token: data.access_token, refresh_token: data.refresh_token, expires_at });
        return true;
      }
    } else {
      // Google Drive - simplified OAuth flow without PKCE
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
      const redirect = `${location.origin}/oauth-callback.html`;
      const params = new URLSearchParams();
      params.append('client_id', clientId as string);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirect);
      const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      const data = await res.json();
      if (data.access_token) {
        const expires_at = Date.now() + (data.expires_in || 3600) * 1000;
        await saveCloudToken('gdrive', { provider: 'gdrive', access_token: data.access_token, refresh_token: data.refresh_token, expires_at });
        return true;
      }
    }
    return false;
  }

  // Token refresh helpers
  async function ensureTokenValid(provider: 'onedrive' | 'gdrive') {
    const token = await loadCloudToken(provider as any);
    if (!token) return null;
    if (token.expires_at && Date.now() < token.expires_at - 60000) return token.access_token; // still valid
    // refresh
    try {
      if (provider === 'onedrive') {
        const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;
        const params = new URLSearchParams();
        params.append('client_id', clientId as string);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', token.refresh_token || '');
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
        const data = await res.json();
        if (data.access_token) {
          const expires_at = Date.now() + (data.expires_in || 3600) * 1000;
          await saveCloudToken('onedrive', { provider: 'onedrive', access_token: data.access_token, refresh_token: data.refresh_token || token.refresh_token, expires_at });
          return data.access_token;
        }
      } else {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
        const params = new URLSearchParams();
        params.append('client_id', clientId as string);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', token.refresh_token || '');
        const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
        const data = await res.json();
        if (data.access_token) {
          const expires_at = Date.now() + (data.expires_in || 3600) * 1000;
          await saveCloudToken('gdrive', { provider: 'gdrive', access_token: data.access_token, refresh_token: data.refresh_token || token.refresh_token, expires_at });
          return data.access_token;
        }
      }
    } catch (e) {
      console.error('Token refresh failed', e);
    }
    return null;
  }


  const uploadToGoogleDrive = async (token: string, filename = `mission-control-export-${new Date().toISOString()}.csv`) => {
    try {
      // upload full JSON payload
      const payload = await exportAllData();
      const metadata = { name: filename.endsWith('.json') ? filename : `${filename}.json`, mimeType: 'application/json' } as any;
      const form = new FormData();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      return res.ok;
    } catch (e) {
      console.error('Google Drive upload failed', e);
      return false;
    }
  };

  // wrapper upload functions that use stored tokens or refresh as needed
  const uploadToOneDriveWithStoredToken = async (filename?: string) => {
    const access = await ensureTokenValid('onedrive');
    if (!access) return false;
    return uploadToOneDrive(access, filename);
  };

  const uploadToGoogleDriveWithStoredToken = async (filename?: string) => {
    const access = await ensureTokenValid('gdrive');
    if (!access) return false;
    return uploadToGoogleDrive(access, filename);
  };

  return (
    <PlansContext.Provider value={{
      plans,
      budgetLogs,
      loading,
  addPlan,
      updatePlan,
      deletePlan,
      addBudgetLog,
  deleteBudgetLog,
      refresh,
      purgeArchivedData,
      historyEnabled,
      setHistoryEnabled,
  exportCSV,
  exportAllData,
  importAllData,
  exportBudgetLogs,
  uploadToOneDrive: uploadToOneDriveWithStoredToken,
  uploadToGoogleDrive: uploadToGoogleDriveWithStoredToken,
  startOneDriveAuth,
  startGoogleAuth,
  handleOAuthCode,
  updateBudgetLog,
          layerTips: LAYER_TIPS as any,
          addSpending,
          getSpendingForDay,
          addTimeUse,
          getTimeUseForDay,
          deleteSpending,
          deleteTimeUse,
          // caps
          categoryCaps,
          setCategoryCap,
          removeCategoryCap,
          getOverCapAlerts,
          // recurring
          recurringExpenses,
          addRecurringExpense,
          updateRecurringExpense,
          deleteRecurringExpense,
          // analytics helpers
          getMonthlySpendingSeries,
          getWeeklyFocusSeries,
      // reflections & resilience
      addReflection,
      getReflectionsBetween,
      addResilience,
      listResilience,
      // momentum
      setMomentumRating,
      getMomentumTrend,
      // goals
      addGoal,
      updateGoal,
      deleteGoal,
      listGoals,
      // habits
      addHabit,
      deleteHabit,
      listHabits,
      setHabitChecked,
      getHabitStreak,
      // history
      addHistoryRecord,
      getHistoryRecords,
      clearHistoryRecords,
    }}>
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
