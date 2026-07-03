-- Change the default plan from 'Mensal' to 'Sem plano' so students who
-- register via invite link are not automatically placed on any paid plan.
-- The coach assigns the plan after the student completes registration.
ALTER TABLE public.students ALTER COLUMN plan SET DEFAULT 'Sem plano';
