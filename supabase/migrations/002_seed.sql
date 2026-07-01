-- Seed executado apenas em desenvolvimento.
-- Crie o coach no Supabase Auth primeiro, depois rode este seed
-- substituindo o UUID abaixo pelo ID real gerado.

-- Exemplo de coach:
-- insert into public.profiles (id, name, email, role)
-- values ('00000000-0000-0000-0000-000000000001', 'Rafael Silva', 'coach@kinea.fit', 'coach');

-- Após criar os perfis via Auth, rode:
-- insert into public.students (coach_id, name, email, goal, plan, pay_status, engagement, since)
-- values
--   ('<coach-uuid>', 'June Mazotini',   'june.m@email.com',    'Hipertrofia',     'Mensal',     'active',  'green',  '2025-03-01'),
--   ('<coach-uuid>', 'Carlos Henrique', 'carlos.h@email.com',  'Emagrecimento',   'Trimestral', 'overdue', 'red',    '2025-01-01'),
--   ('<coach-uuid>', 'Aline Souza',     'aline.s@email.com',   'Recomposição',    'Semestral',  'active',  'green',  '2024-10-01'),
--   ('<coach-uuid>', 'Diego Farias',    'diego.f@email.com',   'Hipertrofia',     'Mensal',     'pending', 'yellow', '2025-04-01'),
--   ('<coach-uuid>', 'Bruno Tavares',   'bruno.t@email.com',   'Força',           'Mensal',     'active',  'green',  '2025-02-01'),
--   ('<coach-uuid>', 'Patrícia Lemos',  'patricia.l@email.com','Condicionamento', 'Permuta',    'active',  'yellow', '2024-11-01'),
--   ('<coach-uuid>', 'Marina Klein',    'marina.k@email.com',  'Emagrecimento',   'Trimestral', 'overdue', 'red',    '2024-12-01'),
--   ('<coach-uuid>', 'Lucas Prado',     'lucas.p@email.com',   'Hipertrofia',     'Mensal',     'pending', 'yellow', '2025-06-01');
