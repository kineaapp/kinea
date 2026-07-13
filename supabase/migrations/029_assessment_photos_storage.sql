-- ── assessment-photos bucket: create + policies ───────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-photos', 'assessment-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read (coach and student can view via public URL)
DROP POLICY IF EXISTS "Public read assessment photos" ON storage.objects;
CREATE POLICY "Public read assessment photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'assessment-photos');

-- Authenticated upload (coach and student can upload)
DROP POLICY IF EXISTS "Authenticated upload assessment photos" ON storage.objects;
CREATE POLICY "Authenticated upload assessment photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessment-photos');

-- Authenticated update/replace (upsert support)
DROP POLICY IF EXISTS "Authenticated update assessment photos" ON storage.objects;
CREATE POLICY "Authenticated update assessment photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assessment-photos');

-- Authenticated delete
DROP POLICY IF EXISTS "Authenticated delete assessment photos" ON storage.objects;
CREATE POLICY "Authenticated delete assessment photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assessment-photos');

-- ── assessments table: allow student insert ───────────────────────────────────

DROP POLICY IF EXISTS "Aluno insere suas avaliações" ON public.assessments;
CREATE POLICY "Aluno insere suas avaliações"
  ON public.assessments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assessments.student_id
        AND s.student_id = auth.uid()
    )
  );

-- Allow student to update own assessments (needed to save photo URLs after insert)
DROP POLICY IF EXISTS "Aluno atualiza suas avaliações" ON public.assessments;
CREATE POLICY "Aluno atualiza suas avaliações"
  ON public.assessments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assessments.student_id
        AND s.student_id = auth.uid()
    )
  );
