-- Tabela de clientes Asaas (1:1 com auth.users)
CREATE TABLE public.clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_customer_id text UNIQUE,
  name              text NOT NULL,
  email             text NOT NULL,
  cpf_cnpj          text NOT NULL,
  phone             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Planos disponíveis (fonte da verdade dos valores)
CREATE TABLE public.plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,
  label          text NOT NULL,
  cycle          text NOT NULL DEFAULT 'MONTHLY',
  value          numeric(10,2) NOT NULL,
  max_payments   int,            -- NULL = recorrência indefinida (mensal)
  payment_method text NOT NULL,  -- 'CREDIT_CARD' | 'PIX'
  active         boolean NOT NULL DEFAULT true
);

INSERT INTO public.plans (code, label, cycle, value, max_payments, payment_method) VALUES
  ('monthly_399',    'Mensal',              'MONTHLY', 399.00, NULL, 'CREDIT_CARD'),
  ('quarterly_card', 'Trimestral — Cartão', 'MONTHLY', 247.00,    3, 'CREDIT_CARD'),
  ('quarterly_pix',  'Trimestral — Pix',   'MONTHLY', 247.00,    3, 'PIX');

-- Assinaturas vinculadas ao Asaas
CREATE TABLE public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id               uuid NOT NULL REFERENCES public.plans(id),
  asaas_subscription_id text UNIQUE NOT NULL,
  status                text NOT NULL DEFAULT 'pending', -- pending|active|overdue|canceled|finished
  current_cycle         int  NOT NULL DEFAULT 0,
  max_cycles            int,
  next_due_date         date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Pagamentos individuais de cada ciclo
CREATE TABLE public.subscription_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  asaas_payment_id  text UNIQUE NOT NULL,
  cycle_number      int NOT NULL,
  value             numeric(10,2) NOT NULL,
  status            text NOT NULL DEFAULT 'pending', -- pending|confirmed|overdue|refunded
  paid_at           timestamptz,
  due_date          date,
  pix_qr_code       text,  -- base64 do QR (apenas Pix)
  pix_copy_paste    text   -- código copia-e-cola Pix
);

-- Log de eventos webhook (auditoria + idempotência)
CREATE TABLE public.asaas_webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text UNIQUE NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhook_events  ENABLE ROW LEVEL SECURITY;

-- clients: cada usuário vê e edita os próprios dados
CREATE POLICY "client_self" ON public.clients
  FOR ALL USING (auth_user_id = auth.uid());

-- plans: leitura para autenticados
CREATE POLICY "plans_read" ON public.plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- subscriptions: usuário vê as suas
CREATE POLICY "sub_self" ON public.subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = subscriptions.client_id AND c.auth_user_id = auth.uid()
    )
  );

-- subscription_payments: usuário vê os seus pagamentos
CREATE POLICY "pay_self" ON public.subscription_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.clients c ON c.id = s.client_id
      WHERE s.id = subscription_payments.subscription_id
        AND c.auth_user_id = auth.uid()
    )
  );
