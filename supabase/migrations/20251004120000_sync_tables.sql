-- Migration: create highlights, reflections, flashcards tables for SmartPDF sync

CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page integer NOT NULL,
  text text NOT NULL,
  note text DEFAULT '',
  pdf_filename text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date,
  q_energized text,
  q_alignment text,
  q_constraint_learning text,
  q_custom1 text,
  q_custom2 text,
  tags text[],
  goal_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  highlight_id uuid,
  question text NOT NULL,
  answer text NOT NULL,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  due_at date,
  interval_days integer,
  ease numeric,
  correct_count integer DEFAULT 0,
  incorrect_count integer DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);

-- Enable RLS
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

-- Simple policies (authenticated users can manage their own rows)
CREATE POLICY "users_manage_highlights" ON highlights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_manage_reflections" ON reflections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_manage_flashcards" ON flashcards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
