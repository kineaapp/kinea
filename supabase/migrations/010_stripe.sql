ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
