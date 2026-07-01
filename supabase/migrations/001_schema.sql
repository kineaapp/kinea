-- ── Enums ────────────────────────────────────────────────────────────────────
create type user_role    as enum ('coach', 'student', 'super_admin');
create type pay_status   as enum ('active', 'pending', 'overdue');
create type sem_color    as enum ('green', 'yellow', 'red');
create type lead_status  as enum ('novo', 'contactado', 'interessado', 'proposta', 'convertido');
create type unit_system  as enum ('metric', 'imperial');

-- ── Profiles (extends auth.users) ────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text        not null,
  email      text        not null,
  phone      text,
  role       user_role   not null default 'student',
  photo_url  text,
  unit       unit_system not null default 'metric',
  anamnese_completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Usuário lê e edita o próprio perfil"
  on public.profiles for all using (auth.uid() = id);
create policy "Coach lê perfis dos próprios alunos"
  on public.profiles for select using (
    exists (
      select 1 from public.students s
      where s.student_id = profiles.id and s.coach_id = auth.uid()
    )
  );

-- ── Students (relação coach ↔ aluno) ─────────────────────────────────────────
create table public.students (
  id              bigserial   primary key,
  coach_id        uuid        not null references public.profiles (id),
  student_id      uuid        references public.profiles (id),   -- null até aceitar convite
  name            text        not null,
  email           text        not null,
  goal            text        not null default 'Hipertrofia',
  plan            text        not null default 'Mensal',
  pay_status      pay_status  not null default 'pending',
  engagement      sem_color   not null default 'green',
  next_assessment date,
  since           date        not null default current_date,
  created_at      timestamptz not null default now()
);
alter table public.students enable row level security;
create policy "Coach gerencia seus alunos"
  on public.students for all using (coach_id = auth.uid());
create policy "Aluno lê o próprio registro"
  on public.students for select using (student_id = auth.uid());

-- ── Payments ─────────────────────────────────────────────────────────────────
create table public.payments (
  id          bigserial   primary key,
  student_id  bigint      not null references public.students (id) on delete cascade,
  amount      numeric(10,2) not null,
  status      pay_status  not null default 'pending',
  due_date    date        not null,
  paid_at     timestamptz,
  description text,
  created_at  timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "Coach acessa pagamentos dos próprios alunos"
  on public.payments for all using (
    exists (select 1 from public.students s where s.id = payments.student_id and s.coach_id = auth.uid())
  );
create policy "Aluno lê seus pagamentos"
  on public.payments for select using (
    exists (select 1 from public.students s where s.id = payments.student_id and s.student_id = auth.uid())
  );

-- ── Workouts ─────────────────────────────────────────────────────────────────
create table public.workouts (
  id           bigserial primary key,
  coach_id     uuid      not null references public.profiles (id),
  name         text      not null,
  description  text,
  muscle_group text,
  difficulty   text      not null default 'Intermediário',
  duration_min int       not null default 45,
  created_at   timestamptz not null default now()
);
alter table public.workouts enable row level security;
create policy "Coach gerencia seus treinos"
  on public.workouts for all using (coach_id = auth.uid());
create policy "Aluno lê treinos atribuídos"
  on public.workouts for select using (
    exists (select 1 from public.workout_assignments wa where wa.workout_id = workouts.id and wa.student_id = (
      select id from public.students where student_id = auth.uid() limit 1
    ))
  );

-- ── Exercises ────────────────────────────────────────────────────────────────
create table public.exercises (
  id         bigserial primary key,
  workout_id bigint    not null references public.workouts (id) on delete cascade,
  name       text      not null,
  sets       int       not null default 3,
  reps       text      not null default '12',
  rest_sec   int       not null default 60,
  sort_order int       not null default 0
);
alter table public.exercises enable row level security;
create policy "Herda acesso do treino"
  on public.exercises for all using (
    exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.coach_id = auth.uid())
  );

-- ── Workout assignments (treino atribuído ao aluno + dia da semana) ───────────
create table public.workout_assignments (
  id          bigserial primary key,
  workout_id  bigint    not null references public.workouts (id) on delete cascade,
  student_id  bigint    not null references public.students (id) on delete cascade,
  day_of_week smallint  check (day_of_week between 0 and 6),  -- 0=Dom … 6=Sab
  assigned_at timestamptz not null default now(),
  unique (workout_id, student_id, day_of_week)
);
alter table public.workout_assignments enable row level security;
create policy "Coach gerencia atribuições"
  on public.workout_assignments for all using (
    exists (select 1 from public.workouts w where w.id = workout_assignments.workout_id and w.coach_id = auth.uid())
  );
create policy "Aluno lê as próprias atribuições"
  on public.workout_assignments for select using (
    exists (select 1 from public.students s where s.id = workout_assignments.student_id and s.student_id = auth.uid())
  );

-- ── Messages ─────────────────────────────────────────────────────────────────
create table public.messages (
  id         bigserial   primary key,
  from_id    uuid        not null references public.profiles (id),
  to_id      uuid        not null references public.profiles (id),
  content    text        not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Participante lê suas mensagens"
  on public.messages for select using (auth.uid() in (from_id, to_id));
create policy "Participante envia mensagem"
  on public.messages for insert with check (auth.uid() = from_id);
create policy "Destinatário marca como lida"
  on public.messages for update using (auth.uid() = to_id);

-- ── Leads (CRM do coach) ─────────────────────────────────────────────────────
create table public.leads (
  id         bigserial   primary key,
  coach_id   uuid        not null references public.profiles (id),
  name       text        not null,
  email      text,
  phone      text,
  status     lead_status not null default 'novo',
  notes      text,
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "Coach gerencia seus leads"
  on public.leads for all using (coach_id = auth.uid());

-- ── Assessments (avaliações físicas) ─────────────────────────────────────────
create table public.assessments (
  id           bigserial primary key,
  student_id   bigint    not null references public.students (id) on delete cascade,
  assessed_at  date      not null default current_date,
  weight_kg    numeric(5,2),
  height_cm    numeric(5,1),
  body_fat_pct numeric(4,1),
  chest_cm     numeric(5,1),
  waist_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  arm_cm       numeric(5,1),
  thigh_cm     numeric(5,1),
  notes        text,
  created_at   timestamptz not null default now()
);
alter table public.assessments enable row level security;
create policy "Coach acessa avaliações dos próprios alunos"
  on public.assessments for all using (
    exists (select 1 from public.students s where s.id = assessments.student_id and s.coach_id = auth.uid())
  );
create policy "Aluno lê suas avaliações"
  on public.assessments for select using (
    exists (select 1 from public.students s where s.id = assessments.student_id and s.student_id = auth.uid())
  );

-- ── Check-ins semanais ────────────────────────────────────────────────────────
create table public.check_ins (
  id         bigserial   primary key,
  student_id bigint      not null references public.students (id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);
alter table public.check_ins enable row level security;
create policy "Coach lê check-ins dos próprios alunos"
  on public.check_ins for select using (
    exists (select 1 from public.students s where s.id = check_ins.student_id and s.coach_id = auth.uid())
  );
create policy "Aluno envia e lê os próprios check-ins"
  on public.check_ins for all using (
    exists (select 1 from public.students s where s.id = check_ins.student_id and s.student_id = auth.uid())
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.check_ins;
