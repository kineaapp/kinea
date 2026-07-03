create table public.anamneses (
  id               bigserial   primary key,
  student_id       uuid        not null references public.profiles (id) on delete cascade,
  nome             text,
  data_nasc        text,
  telefone         text,
  profissao        text,
  doencas          text,
  outra_doenca     text,
  medicamentos     text,
  cirurgia         text,
  limitacoes       text,
  pratica_atual    text,
  atividade_atual  text,
  treinou_personal text,
  objetivo         text,
  dias_semana      text,
  horario          text,
  horas_sono       text,
  nivel_estresse   text,
  fuma             text,
  alcool           text,
  created_at       timestamptz not null default now()
);

alter table public.anamneses enable row level security;

create policy "Aluno insere propria anamnese"
  on public.anamneses for insert
  with check (student_id = auth.uid());

create policy "Aluno le propria anamnese"
  on public.anamneses for select
  using (student_id = auth.uid());

create policy "Coach le anamneses dos alunos"
  on public.anamneses for select
  using (
    exists (
      select 1 from public.students s
      where s.student_id = anamneses.student_id
        and s.coach_id = auth.uid()
    )
  );
