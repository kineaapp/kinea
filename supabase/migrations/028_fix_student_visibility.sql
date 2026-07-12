-- ── 1. chat_messages: add to realtime + student RLS ──────────────────────────

-- Table was created manually; ensure RLS is on
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Idempotent policies
DROP POLICY IF EXISTS "coach_chat_messages"   ON public.chat_messages;
DROP POLICY IF EXISTS "student_chat_messages" ON public.chat_messages;

-- Coach: full access to their students' threads
CREATE POLICY "coach_chat_messages" ON public.chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = chat_messages.student_id
        AND s.coach_id = auth.uid()
    )
  );

-- Student: read + insert their own thread
CREATE POLICY "student_chat_messages" ON public.chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = chat_messages.student_id
        AND s.student_id = auth.uid()
    )
  );

-- Add to realtime so students receive new messages live
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. student_attachments: student RLS + public storage read ─────────────────

-- Table was created manually; ensure RLS is on
ALTER TABLE public.student_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_student_attachments"   ON public.student_attachments;
DROP POLICY IF EXISTS "student_student_attachments" ON public.student_attachments;

-- Coach: full access to their students' attachments
CREATE POLICY "coach_student_attachments" ON public.student_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_attachments.student_id
        AND s.coach_id = auth.uid()
    )
  );

-- Student: read only
CREATE POLICY "student_student_attachments" ON public.student_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_attachments.student_id
        AND s.student_id = auth.uid()
    )
  );

-- Ensure the storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-attachments', 'student-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy (same pattern as chat-attachments)
DROP POLICY IF EXISTS "Public read student attachments" ON storage.objects;
CREATE POLICY "Public read student attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'student-attachments');

-- Authenticated upload (coach uploads)
DROP POLICY IF EXISTS "Authenticated upload student attachments" ON storage.objects;
CREATE POLICY "Authenticated upload student attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-attachments');

-- Authenticated delete (coach removes)
DROP POLICY IF EXISTS "Authenticated delete student attachments" ON storage.objects;
CREATE POLICY "Authenticated delete student attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-attachments');
