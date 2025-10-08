import Dexie from 'dexie';

export interface PlanRecord {
  id: string;
  user_id?: string;
  title: string;
  layer: 'Vision' | 'Strategy' | 'Tactic';
  category: string;
  start_date: string;
  end_date: string;
  budget_planned: number;
  budget_spent: number;
  progress: number;
  notes: string;
  status: 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface BudgetLogRecord {
  id: string;
  plan_id: string;
  user_id?: string;
  amount: number;
  description: string;
  type?: string;
  date: string;
  created_at?: string;
}

export interface SpendingEntry {
  id: string;
  user_id?: string;
  amount: number;
  currency?: string; // e.g., TZS
  datetime: string; // ISO
  description: string;
  goal_id?: string;
}

export interface TimeUseEntry {
  id: string;
  user_id?: string;
  start: string; // ISO
  end?: string; // ISO
  duration_minutes?: number;
  description: string;
  category?: string;
  goal_id?: string;
}

export interface CategoryCapRecord {
  id: string; // use category as id for uniqueness
  category: string;
  monthly_cap: number; // currency amount
  created_at?: string;
  updated_at?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringExpenseRecord {
  id: string;
  category?: string;
  amount: number;
  description: string;
  currency?: string;
  frequency: RecurringFrequency;
  start_date: string; // ISO date (YYYY-MM-DD) start
  end_date?: string;  // ISO date
  next_run_date: string; // ISO date (YYYY-MM-DD)
  created_at?: string;
  updated_at?: string;
}

export interface GoalRecord {
  id: string;
  title: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReflectionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  q_energized?: string;
  q_alignment?: string;
  q_constraint_learning?: string;
  q_custom1?: string;
  q_custom2?: string;
  tags?: string[];
  goal_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HighlightRecord {
  id: string;
  user_id?: string;
  page: number;
  text: string;
  note?: string;
  pdf_filename?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FlashcardRecord {
  id: string;
  user_id?: string;
  highlight_id?: string;
  question: string;
  answer: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  // Simple SRS fields
  due_at?: string; // ISO date when next review due
  interval_days?: number; // days between reviews
  ease?: number; // ease factor
  correct_count?: number;
  incorrect_count?: number;
}

export interface PDFRecord {
  id: string;
  user_id?: string;
  filename: string;
  blob?: Blob | null;
  last_page_read?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ResilienceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  setback: string;
  reframe: string;
  next_step: string;
  tags?: string[];
  goal_id?: string;
  created_at?: string;
}

export interface MomentumRecord {
  id: string;
  date: string; // YYYY-MM-DD
  rating: number; // 1-5
  created_at?: string;
}

export interface HabitRecord {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HabitCheckRecord {
  id: string; // habitId-date
  habit_id: string;
  date: string; // YYYY-MM-DD
  created_at?: string;
}

export interface HistoryRecord {
  id: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  created_at?: string;
  synced?: boolean;
}

export interface SyncLogRecord {
  id: string;
  user_id?: string;
  result_json: string;
  created_at?: string;
}

export interface AuthCacheRecord {
  id: string; // use a fixed id like 'primary'
  user: any;
  email: string;
  passHash: string;
  salt: string;
  cachedAt: string;
}

class MissionDB extends Dexie {
  plans!: Dexie.Table<PlanRecord, string>;
  budget_logs!: Dexie.Table<BudgetLogRecord, string>;
  settings!: Dexie.Table<any, string>;
  spending!: Dexie.Table<any, string>;
  time_use!: Dexie.Table<any, string>;
  auth_cache!: Dexie.Table<AuthCacheRecord, string>;
  assistant_messages!: Dexie.Table<any, string>;
  highlights!: Dexie.Table<HighlightRecord, string>;
  flashcards!: Dexie.Table<FlashcardRecord, string>;
  pdfs!: Dexie.Table<PDFRecord, string>;
  category_caps!: Dexie.Table<CategoryCapRecord, string>;
  sync_logs!: Dexie.Table<SyncLogRecord, string>;
  recurring_expenses!: Dexie.Table<RecurringExpenseRecord, string>;
  goals!: Dexie.Table<GoalRecord, string>;
  reflections!: Dexie.Table<ReflectionRecord, string>;
  resilience_logs!: Dexie.Table<ResilienceRecord, string>;
  momentum!: Dexie.Table<MomentumRecord, string>;
  habits!: Dexie.Table<HabitRecord, string>;
  habit_checks!: Dexie.Table<HabitCheckRecord, string>;
  history!: Dexie.Table<HistoryRecord, string>;

  constructor() {
    super('mission_control_db');
    this.version(1).stores({
      plans: 'id, user_id, title, layer, category, status, start_date, end_date, created_at, updated_at',
      budget_logs: 'id, plan_id, user_id, date, type, created_at',
      spending: 'id, user_id, datetime, amount, goal_id',
      time_use: 'id, user_id, start, end, category, goal_id',
      settings: 'id, key',
    });

    // Add auth_cache in a new version migration
    this.version(2).stores({
      auth_cache: 'id,email,cachedAt',
    });

    // v3: assistant chat messages (for offline-first chat history and context)
    // Index by created_at for fast retrieval of recent history
    this.version(3).stores({
      assistant_messages: 'id, role, created_at',
    });

    // v4: budget category caps and recurring expenses
    this.version(4).stores({
      category_caps: 'id, category, updated_at',
      recurring_expenses: 'id, frequency, next_run_date, start_date',
    });

    this.version(5).stores({
      goals: 'id, title, category, updated_at',
      reflections: 'id, date, goal_id',
      resilience_logs: 'id, date, goal_id',
      momentum: 'id, date',
      spending: 'id, user_id, datetime, amount, goal_id',
      time_use: 'id, user_id, start, end, category, goal_id',
      highlights: 'id, user_id, page, pdf_filename, created_at',
      flashcards: 'id, user_id, highlight_id, created_at',
  pdfs: 'id, user_id, filename, created_at, updated_at',
    });

    this.version(6).stores({
      habits: 'id, title, updated_at',
      habit_checks: 'id, habit_id, date',
    });

    this.version(7).stores({
      history: 'id, table_name, record_id, action, created_at, synced',
    });

    this.version(8).stores({
      sync_logs: 'id, user_id, created_at'
    });
  }
}

export const db = new MissionDB();

export default db;
