-- Add assessment_completed flag to profiles
alter table public.profiles
  add column if not exists assessment_completed boolean not null default false;

-- Students who already completed anamnese skip the first assessment gate
update public.profiles
  set assessment_completed = true
  where anamnese_completed = true;
