-- Permite que coaches leiam clients/subscriptions/payments dos seus alunos

CREATE POLICY coach_read_clients ON public.clients FOR SELECT
USING (
  auth_user_id IN (
    SELECT student_id FROM students WHERE coach_id = auth.uid()
  )
);

CREATE POLICY coach_read_subscriptions ON public.subscriptions FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN students s ON s.student_id = c.auth_user_id
    WHERE s.coach_id = auth.uid()
  )
);

CREATE POLICY coach_read_subscription_payments ON public.subscription_payments FOR SELECT
USING (
  subscription_id IN (
    SELECT sub.id FROM subscriptions sub
    JOIN clients c ON c.id = sub.client_id
    JOIN students s ON s.student_id = c.auth_user_id
    WHERE s.coach_id = auth.uid()
  )
);
