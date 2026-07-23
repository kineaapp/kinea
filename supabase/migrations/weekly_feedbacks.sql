-- Tabela de check-ins semanais do aluno
CREATE TABLE IF NOT EXISTS public.weekly_feedbacks (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  workouts    SMALLINT NOT NULL CHECK (workouts BETWEEN 0 AND 7),
  sleep       SMALLINT NOT NULL CHECK (sleep BETWEEN 1 AND 5),
  nutrition   SMALLINT NOT NULL CHECK (nutrition BETWEEN 1 AND 5),
  mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_feedbacks_student_week_uq UNIQUE (student_id, week_start)
);

ALTER TABLE public.weekly_feedbacks ENABLE ROW LEVEL SECURITY;

-- Aluno pode inserir e ler seus próprios check-ins
CREATE POLICY "aluno_insert_own_weekly_feedback"
  ON public.weekly_feedbacks FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "aluno_select_own_weekly_feedback"
  ON public.weekly_feedbacks FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "aluno_update_own_weekly_feedback"
  ON public.weekly_feedbacks FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE student_id = auth.uid()
    )
  );

-- Coach pode ler todos os check-ins
CREATE POLICY "coach_select_all_weekly_feedbacks"
  ON public.weekly_feedbacks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Habilita Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_feedbacks;
