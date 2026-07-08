DO $$
DECLARE
  v_coach_id  uuid;
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
  VALUES (v_coach_id, 'Ruan Lehmann', '', 'Hipertrofia', 'Trimestral', 'pending', '2026-06-26')
  RETURNING id INTO v_student_id;

  INSERT INTO public.payments (student_id, amount, status, due_date, description) VALUES
    (v_student_id, 247.00, 'pending', '2026-06-26', 'Trimestral – parcela 1/3'),
    (v_student_id, 247.00, 'pending', '2026-07-26', 'Trimestral – parcela 2/3'),
    (v_student_id, 247.00, 'pending', '2026-08-26', 'Trimestral – parcela 3/3');
END $$;
