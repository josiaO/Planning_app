import db from './db';
import { v4 as uuidv4 } from 'uuid';

// AI model identifier (kept as a comment since AI calls are proxied server-side)
// models/text-bison-001

let sessionApiKey: string | null = null;
let sessionProvider: string = 'google';
// start with an empty session model and resolve to a safe default at call time
// Default session model: prefer a safe text model when not explicitly chosen
let sessionModel: string = 'text-bison-001';

// Small mapping of common Gemini aliases to canonical model ids (short names).
// The server will try variations (including prefixing with 'models/') if needed.
const MODEL_ALIASES: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-1.5-flash',
  'gemini-1.5': 'gemini-1.5-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-flash-001': 'gemini-1.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.0-flash',
  'text-bison-001': 'text-bison-001',
};

// Preference order when selecting a safe default if the requested model isn't available
const PREFERRED_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'text-bison-001', 'gpt-4o-mini'];

export function setSessionApiKey(key: string | null) { sessionApiKey = key; }
export function getSessionApiKey() { return sessionApiKey; }
export function setSessionProvider(p: string) { sessionProvider = p; }
export function setSessionModel(m: string) { sessionModel = m; }

// Accepts: prompt, temperature, providerArg, modelArg, action, activity_data
async function callGemini(prompt: string, temperature = 0.2, providerArg?: string, modelArg?: string, action: string = 'analyze', activity_data?: any) {
  const provider = providerArg || sessionProvider || 'google';
  // Resolve model: prefer explicit modelArg, then sessionModel, then try to pick a safe default.
  async function resolveModel(): Promise<string> {
    const candidate = (modelArg || sessionModel || '').trim();
    // map aliases first
    const mapped = candidate && MODEL_ALIASES[candidate] ? MODEL_ALIASES[candidate] : candidate;

    // If we have no API key, we can't reliably list provider models; return mapped or a safe default
    if (!sessionApiKey) {
      if (mapped) return mapped;
      // pick first preferred
      return PREFERRED_MODELS[0];
    }

    // Try asking the server for available models and pick a supported one
    try {
      const res = await fetch('/api/agent/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, api_key: sessionApiKey }),
      });
      if (!res.ok) {
        // fallback to mapped or preferred
        return mapped || PREFERRED_MODELS[0];
      }
      const j = await res.json();
      const models: string[] = Array.isArray(j?.models) ? j.models : [];
      // If mapped is available in the list, use it
      if (mapped && models.includes(mapped)) return mapped;
      // Maybe the list contains short names without 'models/' prefix; try to match aliases
      for (const alias of Object.values(MODEL_ALIASES)) {
        if (models.includes(alias) || models.includes(`models/${alias}`)) return alias;
      }
      // pick the first preferred model that the server actually reports
      for (const pref of PREFERRED_MODELS) {
        if (models.includes(pref) || models.includes(`models/${pref}`)) return pref;
      }
      // final fallback: mapped or first preferred
      return mapped || PREFERRED_MODELS[0];
    } catch (e) {
      return mapped || PREFERRED_MODELS[0];
    }
  }

  const model = await resolveModel();
  // Require network for actual LLM calls
  if (typeof window !== 'undefined' && !navigator.onLine) {
    throw new Error('AI assistant requires network connectivity (online)');
  }

  // Prefer the app server proxy so API keys remain client-controlled but not embedded in code.
  try {
    const proxyBody: any = {
      action,
      provider,
      api_key: sessionApiKey,
      model,
      temperature,
      activity_data: activity_data !== undefined ? activity_data : { raw_prompt: prompt }
    };
    const proxyRes = await fetch('/api/agent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proxyBody) });
    // parse body safely
    const raw = await proxyRes.text();
    try {
      const data = JSON.parse(raw);
      if (proxyRes.ok) return data?.text ?? data;
      const detail = data?.detail ?? data;
      throw new Error(`Agent proxy error ${proxyRes.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    } catch (e) {
      // not JSON
      if (proxyRes.ok) return raw;
      throw new Error(`Agent proxy error ${proxyRes.status}: ${raw}`);
    }
  } catch (e) {
    // Surface proxy/network error to caller so front-end can show a helpful message
    throw new Error(`Agent proxy request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  // No direct provider calls from the browser: callers should use the server proxy.
  throw new Error('No direct provider calls allowed from client. Ensure the app server proxy (/api/agent/generate) is available and you provided an API key via AI Settings.');
}

// Local analytic helpers
export async function analyzeBehaviorSummary() {
  const plans = await db.plans.toArray();
  const spending = await db.spending.toArray();
  const time_use = await db.time_use.toArray();

  const totalSpending = spending.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const avgDailySpending = (() => {
    if (spending.length === 0) return 0;
    const dates = new Set(spending.map((s: any) => s.datetime.slice(0, 10)));
    return totalSpending / Math.max(1, dates.size);
  })();

  const totalMinutes = time_use.reduce((s: number, t: any) => s + Number(t.duration_minutes || 0), 0);
  const avgDailyMinutes = (() => {
    if (time_use.length === 0) return 0;
    const dates = new Set(time_use.flatMap((t: any) => [t.start?.slice(0,10), t.end?.slice(0,10)].filter(Boolean)));
    return Math.round(totalMinutes / Math.max(1, dates.size));
  })();

  const activePlans = plans.filter(p => p.status === 'active');

  return {
    plansCount: plans.length,
    activePlans: activePlans.length,
    totalSpending,
    avgDailySpending: Number(avgDailySpending.toFixed(2)),
    totalTimeMinutes: totalMinutes,
    avgDailyMinutes,
  };
}

export async function suggestDailyTargetsForReading(pagesPerWeek: number) {
  // simple division by 7, but adjust for typical user activity using time_use average
  const info = await analyzeBehaviorSummary();
  const base = Math.max(1, Math.ceil(pagesPerWeek / 7));
  // if user average daily minutes for focused work is low, reduce target and suggest time allocation
  const avgMinutes = info.avgDailyMinutes || 0;
  let recommendedPagesPerDay = base;
  let note = '';
  if (avgMinutes < 30) {
    recommendedPagesPerDay = Math.max(1, Math.ceil((pagesPerWeek * 0.8) / 7));
    note = 'Your tracked focused time is low — consider short daily sessions (10-15 minutes) to build habit.';
  } else if (avgMinutes > 90) {
    recommendedPagesPerDay = Math.ceil(pagesPerWeek / 7);
    note = 'You have good focused time; spreading pages evenly across the week should work.';
  }
  return { pagesPerDay: recommendedPagesPerDay, note };
}

export async function predictOutcomesBrief() {
  // build a prompt using local aggregates and ask Gemini for short predictions
  const summary = await analyzeBehaviorSummary();
  const prompt = `I have the following activity summary from a planning app: ${JSON.stringify(summary)}.\n\nGiven this data, predict likely outcomes for the user's strategic plans and habits in the next 3 months. Give: 3 bullet-point risks, 3 opportunities, and 3 concrete suggestions the user can follow.`;
  try {
    const ans = await callGemini(prompt, 0.3, undefined, undefined, 'predict', summary);
    return ans;
  } catch (e:any) {
    return `AI prediction failed: ${e.message}`;
  }
}

// Deterministic projection helpers
function groupByMonth(entries: any[], dateField: string) {
  const map = new Map<string, any[]>();
  for (const e of entries) {
    const d = (e[dateField] || e.datetime || e.start || '').slice(0, 7); // YYYY-MM
    if (!d) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(e);
  }
  return map;
}

function monthlySpendingSeries(spending: any[]) {
  const byMonth = groupByMonth(spending, 'datetime');
  const months = Array.from(byMonth.keys()).sort();
  const series = months.map(m => ({ month: m, total: byMonth.get(m)!.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) }));
  return series;
}

function linearTrend(values: number[]) {
  // simple linear regression slope (least squares) y = a + b*x
  const n = values.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }).map((_, i) => i);
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - xMean) * (values[i] - yMean); den += (xs[i] - xMean) ** 2; }
  if (den === 0) return 0;
  return num / den; // slope per month
}

function projectSeries(series: { month: string; total: number }[], monthsOut = 12) {
  const values = series.map(s => s.total);
  const slope = linearTrend(values);
  const last = values.length ? values[values.length - 1] : 0;
  const projections: { month: string; projected: number }[] = [];
  const lastMonth = series.length ? series[series.length - 1].month : new Date().toISOString().slice(0,7);
  const [y, m] = lastMonth.split('-').map(Number);
  for (let i = 1; i <= monthsOut; i++) {
    const mm = new Date(y, m - 1 + i);
    const monthKey = `${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, '0')}`;
    const projected = Math.max(0, Math.round(last + slope * i));
    projections.push({ month: monthKey, projected });
  }
  return { slope, projections };
}

function projectTimeUse(time_use: any[], monthsOut = 12) {
  // summarize by month of total minutes
  const byMonth = groupByMonth(time_use, 'start');
  const months = Array.from(byMonth.keys()).sort();
  const series = months.map(m => ({ month: m, total: byMonth.get(m)!.reduce((s: number, t: any) => s + Number(t.duration_minutes || 0), 0) }));
  return projectSeries(series, monthsOut);
}

function projectSpending(spending: any[], monthsOut = 12) {
  const series = monthlySpendingSeries(spending);
  return projectSeries(series, monthsOut);
}

function planCompletionProjection(plans: any[]) {
  // estimate completion rate by looking at progress increases over time if available
  // fallback: simple heuristic based on progress field and typical time window
  const active = plans.filter(p => p.status === 'active');
  const projections = active.map(p => ({ id: p.id, title: p.title, currentProgress: Number(p.progress || 0), projectedProgressIn12Months: Math.min(100, Number(p.progress || 0) + 12 * 5) }));
  return projections;
}

export async function projectOneYearOutcomes() {
  const plans = await db.plans.toArray();
  const spending = await db.spending.toArray();
  const time_use = await db.time_use.toArray();

  const spendingProj = projectSpending(spending, 12);
  const timeProj = projectTimeUse(time_use, 12);
  const planProj = planCompletionProjection(plans);

  // Build summary for AI
  const summary = {
    plansCount: plans.length,
    activePlans: plans.filter(p => p.status === 'active').length,
    spendingSlopePerMonth: spendingProj.slope,
    timeSlopePerMonth: timeProj.slope,
    planProjections: planProj.map(p => ({ id: p.id, title: p.title, current: p.currentProgress, projected12m: p.projectedProgressIn12Months })),
    spendingProjectionSample: spendingProj.projections.slice(0, 6),
    timeProjectionSample: timeProj.projections.slice(0, 6),
  };

  // Ask the AI for narrative predictions and recommendations for 12 months
  const prompt = `You are an assistant that helps users predict where they'll be in 1 year given their activity data. Here is the deterministic summary: ${JSON.stringify(summary)}.\n\nProvide: (1) a 3-paragraph high-level prediction of the user's likely state in one year; (2) 5 prioritized recommendations the user can follow now to improve outcomes; (3) a short monthly plan template to reach those recommendations.`;
  let aiNarrative = '';
  try {
    aiNarrative = await callGemini(prompt, 0.3, undefined, undefined, 'predict', summary);
  } catch (e:any) {
    aiNarrative = `AI call failed: ${e.message}`;
  }

  return { deterministic: summary, aiNarrative };
}

export async function personalizedPathSuggestion(goal: { kind: string; details: any }) {
  const summary = await analyzeBehaviorSummary();
  const spending = await db.spending.toArray();
  const time_use = await db.time_use.toArray();
  // Local advice functions for budget/time
  const localBudgetAdvice = (() => {
    const recent = spending.slice(-30);
    const total = recent.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const avg = recent.length ? total / recent.length : 0;
    const tip = avg > 0 ? `Your recent avg spend per entry is ${avg.toFixed(0)}. Consider a daily cap at ${(avg * 0.8).toFixed(0)}.` : 'Track spending consistently for stronger advice.';
    return { avgPerEntry: Number(avg.toFixed(2)), tip };
  })();
  const localTimeAdvice = (() => {
    const recent = time_use.slice(-30);
    const total = recent.reduce((s: number, t: any) => s + Number(t.duration_minutes || 0), 0);
    const avg = recent.length ? total / recent.length : 0;
    const tip = avg < 30 ? 'Try 15-minute daily focus blocks to build momentum.' : 'Maintain consistent focus blocks and review weekly.';
    return { avgMinutesPerEntry: Math.round(avg), tip };
  })();
  let localSuggestion: any = null;
  if (goal.kind === 'reading') {
    const pagesPerWeek = Number(goal.details.pagesPerWeek || 20);
    localSuggestion = await suggestDailyTargetsForReading(pagesPerWeek);
  } else {
    localSuggestion = { text: 'No local suggestion available for this goal.' };
  }

  const prompt = `User goal: ${JSON.stringify(goal)}. Activity summary: ${JSON.stringify(summary)}. Provide a personalized weekly plan, daily targets, and a suggested 12-week progression to achieve the goal. Be concise.`;
  try {
    const aiText = await callGemini(prompt, 0.2, undefined, undefined, 'analyze', { summary, spending, time_use });
    return { local: { ...localSuggestion, budget: localBudgetAdvice, time: localTimeAdvice }, narrative: aiText };
  } catch (e:any) {
    return { local: { ...localSuggestion, budget: localBudgetAdvice, time: localTimeAdvice }, narrative: `AI call failed: ${e.message}` };
  }
}

export default { callGemini, analyzeBehaviorSummary, suggestDailyTargetsForReading, predictOutcomesBrief, personalizedPathSuggestion };

// Agent utilities
export type AgentMessage = { id: string; role: 'system' | 'user' | 'assistant'; content: string; created_at: string };

export async function getRecentMessages(limit = 30): Promise<AgentMessage[]> {
  const all = await db.assistant_messages.orderBy('created_at').reverse().limit(limit).toArray();
  return all.reverse();
}

export async function addMessage(role: 'system' | 'user' | 'assistant', content: string): Promise<AgentMessage> {
  const msg: AgentMessage = { id: uuidv4(), role, content, created_at: new Date().toISOString() };
  await db.assistant_messages.add(msg as any);
  return msg;
}

export async function buildContextSummary() {
  const summary = await analyzeBehaviorSummary();
  const plans = await db.plans.orderBy('updated_at').reverse().limit(5).toArray();
  const recentSpend = await db.spending.orderBy('datetime').reverse().limit(5).toArray();
  const recentTime = await db.time_use.orderBy('start').reverse().limit(5).toArray();
  return { summary, recent: { plans, spending: recentSpend, time_use: recentTime } };
}

export async function agentChat(userText: string) {
  await addMessage('user', userText);
  const ctx = await buildContextSummary();
  const history = await getRecentMessages(10);
  const historyText = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');
  const system = 'You are a personal planning and budgeting assistant. Be concise, actionable, and respectful. Use available context to tailor advice. When giving money or time advice, reference concrete numbers when possible.';
  const prompt = `${system}\n\nContext: ${JSON.stringify(ctx)}\n\nRecent chat:\n${historyText}\n\nUser: ${userText}\n\nAssistant: Provide a short, helpful response. If suggesting actions, list 3-5 bullets.`;
  let answer = '';
  try {
    answer = await callGemini(prompt, 0.25, undefined, undefined, 'analyze', ctx);
  } catch (e: any) {
    answer = `AI failed: ${e.message}`;
  }
  await addMessage('assistant', answer);
  return answer;
}

export async function agentSuggestions() {
  const ctx = await buildContextSummary();
  const prompt = `Given this personal app context: ${JSON.stringify(ctx)}\nProvide: \n- top 3 spending optimizations\n- top 3 time-use improvements\n- 3 next actions aligned to active plans\nBe specific to the numbers.`;
  try {
    const ans = await callGemini(prompt, 0.2, undefined, undefined, 'analyze', ctx);
    return ans;
  } catch (e: any) {
    return `AI failed: ${e.message}`;
  }
}
