DO $$
DECLARE
  v_student_id bigint := 16;
BEGIN
  -- Corrige data de início e status do aluno
  UPDATE public.students
  SET since = '2025-12-17', pay_status = 'active'
  WHERE id = v_student_id;

  INSERT INTO public.payments (student_id, amount, status, due_date, paid_at, description) VALUES
    (v_student_id, 207.00, 'active',  '2025-12-17', '2025-12-17T12:00:00Z', 'Anual – parcela 1/12'),
    (v_student_id, 207.00, 'active',  '2026-01-17', '2026-01-17T12:00:00Z', 'Anual – parcela 2/12'),
    (v_student_id, 207.00, 'active',  '2026-02-17', '2026-02-17T12:00:00Z', 'Anual – parcela 3/12'),
    (v_student_id, 207.00, 'active',  '2026-03-17', '2026-03-17T12:00:00Z', 'Anual – parcela 4/12'),
    (v_student_id, 207.00, 'active',  '2026-04-17', '2026-04-17T12:00:00Z', 'Anual – parcela 5/12'),
    (v_student_id, 207.00, 'active',  '2026-05-17', '2026-05-17T12:00:00Z', 'Anual – parcela 6/12'),
    (v_student_id, 207.00, 'active',  '2026-06-17', '2026-06-17T12:00:00Z', 'Anual – parcela 7/12'),
    (v_student_id, 207.00, 'pending', '2026-07-17', NULL,                   'Anual – parcela 8/12'),
    (v_student_id, 207.00, 'pending', '2026-08-17', NULL,                   'Anual – parcela 9/12'),
    (v_student_id, 207.00, 'pending', '2026-09-17', NULL,                   'Anual – parcela 10/12'),
    (v_student_id, 207.00, 'pending', '2026-10-17', NULL,                   'Anual – parcela 11/12'),
    (v_student_id, 207.00, 'pending', '2026-11-17', NULL,                   'Anual – parcela 12/12');
END $$;
