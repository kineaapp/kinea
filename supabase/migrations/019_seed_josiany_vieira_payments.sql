DO $$
DECLARE
  v_student_id bigint := 12;
BEGIN
  UPDATE public.students
  SET since = '2026-06-10', pay_status = 'active'
  WHERE id = v_student_id;

  INSERT INTO public.payments (student_id, amount, status, due_date, paid_at, description) VALUES
    (v_student_id, 247.00, 'active',  '2026-06-10', '2026-06-10T12:00:00Z', 'Trimestral – parcela 1/3'),
    (v_student_id, 247.00, 'pending', '2026-07-10', NULL,                   'Trimestral – parcela 2/3'),
    (v_student_id, 247.00, 'pending', '2026-08-10', NULL,                   'Trimestral – parcela 3/3');
END $$;
