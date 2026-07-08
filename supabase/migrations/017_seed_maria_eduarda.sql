DO $$
DECLARE
  v_coach_id   uuid;
  v_student_id bigint;
BEGIN
  SELECT id INTO v_coach_id
  FROM public.profiles
  WHERE role = 'coach'
  ORDER BY created_at
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum coach encontrado em profiles';
  END IF;

  INSERT INTO public.students (coach_id, name, email, goal, plan, pay_status, since)
  VALUES (v_coach_id, 'Maria Eduarda', '', 'Hipertrofia', 'Semestral', 'active', '2026-03-20')
  RETURNING id INTO v_student_id;

  INSERT INTO public.payments (student_id, amount, status, due_date, paid_at, description) VALUES
    (v_student_id, 227.00, 'active',  '2026-03-20', '2026-03-20T12:00:00Z', 'Semestral – parcela 1/6'),
    (v_student_id, 227.00, 'active',  '2026-04-20', '2026-04-20T12:00:00Z', 'Semestral – parcela 2/6'),
    (v_student_id, 227.00, 'active',  '2026-05-20', '2026-05-20T12:00:00Z', 'Semestral – parcela 3/6'),
    (v_student_id, 227.00, 'active',  '2026-06-20', '2026-06-20T12:00:00Z', 'Semestral – parcela 4/6'),
    (v_student_id, 227.00, 'pending', '2026-07-20', NULL,                   'Semestral – parcela 5/6'),
    (v_student_id, 227.00, 'pending', '2026-08-20', NULL,                   'Semestral – parcela 6/6');
END $$;
