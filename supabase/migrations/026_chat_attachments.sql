ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size int,
  ADD COLUMN IF NOT EXISTS attachment_kind text;

-- Storage bucket for anamnese PDFs and chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- RLS: public read
CREATE POLICY "Public read chat attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-attachments');
