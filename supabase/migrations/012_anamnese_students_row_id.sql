-- Allow anamneses to be linked to students who haven't registered yet
-- by referencing the integer students.id instead of the auth UUID

ALTER TABLE public.anamneses ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.anamneses ADD COLUMN students_row_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE;

-- Rebuild coach SELECT policy to cover both link types
DROP POLICY IF EXISTS "Coach le anamneses dos alunos" ON public.anamneses;
CREATE POLICY "Coach le anamneses dos alunos"
  ON public.anamneses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.coach_id = auth.uid()
        AND (
          (anamneses.student_id IS NOT NULL AND s.student_id = anamneses.student_id)
          OR
          (anamneses.students_row_id IS NOT NULL AND s.id = anamneses.students_row_id)
        )
    )
  );

-- Rebuild coach INSERT policy
DROP POLICY IF EXISTS "Coach insere anamnese do aluno" ON public.anamneses;
CREATE POLICY "Coach insere anamnese do aluno"
  ON public.anamneses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.coach_id = auth.uid()
        AND (
          (anamneses.student_id IS NOT NULL AND s.student_id = anamneses.student_id)
          OR
          (anamneses.students_row_id IS NOT NULL AND s.id = anamneses.students_row_id)
        )
    )
  );

-- Rebuild coach UPDATE policy
DROP POLICY IF EXISTS "Coach atualiza anamnese do aluno" ON public.anamneses;
CREATE POLICY "Coach atualiza anamnese do aluno"
  ON public.anamneses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.coach_id = auth.uid()
        AND (
          (anamneses.student_id IS NOT NULL AND s.student_id = anamneses.student_id)
          OR
          (anamneses.students_row_id IS NOT NULL AND s.id = anamneses.students_row_id)
        )
    )
  );
