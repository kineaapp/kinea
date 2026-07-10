alter table public.assessments
  add column if not exists photo_frente_url    text,
  add column if not exists photo_lado_esq_url  text,
  add column if not exists photo_lado_dir_url  text,
  add column if not exists photo_costas_url    text;
