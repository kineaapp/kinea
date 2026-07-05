ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
