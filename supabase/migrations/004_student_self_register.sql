-- Allow a student to insert their own record into students
-- when registering via an invite link (coach_id comes from the URL).
create policy "Aluno insere próprio registro"
  on public.students
  for insert
  with check (student_id = auth.uid());
