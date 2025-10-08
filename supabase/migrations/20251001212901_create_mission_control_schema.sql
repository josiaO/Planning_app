/*
  # Mission Control Planning App - Database Schema

  ## Overview
  This migration creates the complete database structure for the Mission Control Planning App,
  a personal planning and budgeting system with three strategic layers.

  ## New Tables

  ### `plans`
  Core table for storing all user plans across three strategic layers (Vision, Strategy, Tactics)
  - `id` (uuid, primary key) - Unique identifier for each plan
  - `user_id` (uuid, foreign key) - Links to auth.users, identifies plan owner
  - `title` (text) - Plan title/name
  - `layer` (text) - Strategic layer: 'Vision', 'Strategy', or 'Tactic'
  - `category` (text) - Plan category (Business, Learning, Personal, Finance, etc.)
  - `start_date` (date) - When the plan begins
  - `end_date` (date) - Target completion date
  - `budget_planned` (numeric) - Planned budget amount
  - `budget_spent` (numeric) - Actual amount spent, defaults to 0
  - `progress` (integer) - Completion percentage (0-100)
  - `notes` (text) - Additional notes and details
  - `status` (text) - Current status: 'active', 'completed', 'archived'
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last modification timestamp

  ### `milestones`
  Tracks progress milestones and logs for each plan
  - `id` (uuid, primary key) - Unique identifier
  - `plan_id` (uuid, foreign key) - Links to plans table
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `title` (text) - Milestone title
  - `description` (text) - Detailed description
  - `date` (timestamptz) - When milestone was reached
  - `created_at` (timestamptz) - Record creation timestamp

  ### `budget_logs`
  Detailed history of all budget transactions
  - `id` (uuid, primary key) - Unique identifier
  - `plan_id` (uuid, foreign key) - Links to plans table
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `amount` (numeric) - Transaction amount
  - `description` (text) - What the spending was for
  - `date` (timestamptz) - Transaction date
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled to ensure users can only access their own data.
  
  ### RLS Policies
  
  #### plans table
  - Users can view only their own plans
  - Users can insert plans only for themselves
  - Users can update only their own plans
  - Users can delete only their own plans
  
  #### milestones table
  - Users can view milestones only for their own plans
  - Users can insert milestones only for their own plans
  - Users can update milestones only for their own plans
  - Users can delete milestones only for their own plans
  
  #### budget_logs table
  - Users can view budget logs only for their own plans
  - Users can insert budget logs only for their own plans
  - Users can update budget logs only for their own plans
  - Users can delete budget logs only for their own plans

  ## Indexes
  - Index on plans(user_id, status) for efficient dashboard queries
  - Index on plans(user_id, layer) for filtering by strategic layer
  - Index on milestones(plan_id) for milestone lookups
  - Index on budget_logs(plan_id) for budget history queries

  ## Important Notes
  1. All monetary values use numeric type for precision
  2. Progress is constrained between 0 and 100
  3. Timestamps track creation and modification times
  4. Foreign key constraints ensure referential integrity
  5. Cascading deletes ensure cleanup when plans are deleted
*/

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  layer text NOT NULL CHECK (layer IN ('Vision', 'Strategy', 'Tactic')),
  category text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  budget_planned numeric(12, 2) DEFAULT 0,
  budget_spent numeric(12, 2) DEFAULT 0,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notes text DEFAULT '',
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create budget_logs table
CREATE TABLE IF NOT EXISTS budget_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12, 2) NOT NULL,
  description text DEFAULT '',
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_plans_user_layer ON plans(user_id, layer);
CREATE INDEX IF NOT EXISTS idx_milestones_plan ON milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_budget_logs_plan ON budget_logs(plan_id);

-- Enable Row Level Security
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plans table
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for milestones table
CREATE POLICY "Users can view own milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for budget_logs table
CREATE POLICY "Users can view own budget logs"
  ON budget_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget logs"
  ON budget_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget logs"
  ON budget_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget logs"
  ON budget_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for plans table
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();