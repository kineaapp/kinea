ALTER TABLE public.students DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.students DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.students DROP COLUMN IF EXISTS stripe_current_period_end;
