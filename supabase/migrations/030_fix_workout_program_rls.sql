-- Aluna consegue ler programa mas não os treinos/exercícios dos slots.
-- Causa: policy de workouts só cobre workout_assignments (legado).
--        exercises não tem nenhuma policy para aluno.

-- ── workouts: adiciona acesso via programa ──────────────────────────────────
DROP POLICY IF EXISTS "Aluno lê treinos do programa ativo" ON public.workouts;
CREATE POLICY "Aluno lê treinos do programa ativo" ON public.workouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.program_slots ps
      JOIN public.program_assignments pa ON pa.program_id = ps.program_id
      JOIN public.students s ON s.id = pa.student_id
      WHERE ps.workout_id = workouts.id
        AND s.student_id = auth.uid()
        AND pa.active = true
    )
  );

-- ── exercises: aluno lê exercícios dos treinos que pode acessar ────────────
DROP POLICY IF EXISTS "Aluno lê exercícios dos treinos atribuídos" ON public.exercises;
CREATE POLICY "Aluno lê exercícios dos treinos atribuídos" ON public.exercises
  FOR SELECT USING (
    -- via workout_assignments (legado)
    EXISTS (
      SELECT 1 FROM public.workout_assignments wa
      JOIN public.students s ON s.id = wa.student_id
      WHERE wa.workout_id = exercises.workout_id
        AND s.student_id = auth.uid()
    )
    OR
    -- via program_slots (programas)
    EXISTS (
      SELECT 1
      FROM public.program_slots ps
      JOIN public.program_assignments pa ON pa.program_id = ps.program_id
      JOIN public.students s ON s.id = pa.student_id
      WHERE ps.workout_id = exercises.workout_id
        AND s.student_id = auth.uid()
        AND pa.active = true
    )
  );
