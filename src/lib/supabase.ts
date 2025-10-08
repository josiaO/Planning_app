import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Plan = {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: string;
  plan_id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  created_at: string;
};

export type BudgetLog = {
  id: string;
  plan_id: string;
  user_id: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
};
