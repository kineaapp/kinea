-- Allow coach to insert and update anamnese for their own students
create policy "Coach insere anamnese do aluno"
  on public.anamneses for insert
  with check (
    exists (
      select 1 from public.students s
      where s.student_id = anamneses.student_id
        and s.coach_id = auth.uid()
    )
  );

create policy "Coach atualiza anamnese do aluno"
  on public.anamneses for update
  using (
    exists (
      select 1 from public.students s
      where s.student_id = anamneses.student_id
        and s.coach_id = auth.uid()
    )
  );
