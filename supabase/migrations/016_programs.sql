-- Programas de treino (templates reutilizáveis ou por aluno)
CREATE TABLE public.programs (
  id            bigserial PRIMARY KEY,
  coach_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  days_per_week int  NOT NULL CHECK (days_per_week BETWEEN 2 AND 6),
  is_template   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Slots do programa (Treino A, B, C…)
CREATE TABLE public.program_slots (
  id          bigserial PRIMARY KEY,
  program_id  bigint NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  position    int    NOT NULL, -- 1 = A, 2 = B, 3 = C…
  workout_id  bigint REFERENCES public.workouts(id) ON DELETE SET NULL,
  day_of_week smallint, -- 0=Dom … 6=Sáb, opcional
  UNIQUE (program_id, position)
);

-- Atribuição de programas a alunos
CREATE TABLE public.program_assignments (
  id          bigserial PRIMARY KEY,
  program_id  bigint NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  active      boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- Coach gerencia seus programas
CREATE POLICY "coach_programs" ON public.programs
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "coach_program_slots" ON public.program_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_slots.program_id AND p.coach_id = auth.uid())
  );

CREATE POLICY "coach_program_assignments" ON public.program_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_assignments.program_id AND p.coach_id = auth.uid())
  );

-- Aluno vê sua própria atribuição
CREATE POLICY "student_program_assignments" ON public.program_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = program_assignments.student_id AND s.student_id = auth.uid())
  );

CREATE POLICY "student_program_slots" ON public.program_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.program_assignments pa
      JOIN public.students s ON s.id = pa.student_id
      WHERE pa.program_id = program_slots.program_id
        AND s.student_id = auth.uid()
        AND pa.active = true
    )
  );

CREATE POLICY "student_programs" ON public.programs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.program_assignments pa
      JOIN public.students s ON s.id = pa.student_id
      WHERE pa.program_id = programs.id
        AND s.student_id = auth.uid()
        AND pa.active = true
    )
  );
