-- Adiciona colunas de plano no students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS plan                     text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stripe_current_period_end bigint;

-- Tabela de solicitações de mudança/renovação de plano
CREATE TABLE IF NOT EXISTS public.plan_requests (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id     bigint NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  current_plan   text   NOT NULL,
  requested_plan text   NOT NULL,
  type           text   NOT NULL CHECK (type IN ('mudanca', 'renovacao')),
  status         text   NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

-- Coach pode ver e atualizar todas as solicitações
CREATE POLICY "coach_all" ON public.plan_requests
  FOR ALL USING (true);
