-- Phase 2 follow-up: replace broad teacher reads with classroom membership scope.
drop policy if exists "Authenticated teachers can read check-ins" on public.check_ins;
create policy "Teachers read assigned classroom check-ins" on public.check_ins
  for select to authenticated
  using (exists (
    select 1 from public.students s
    join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
    where s.id = check_ins.student_id and ct.teacher_id = auth.uid()
  ));

drop policy if exists "Anyone can read active students" on public.students;
create policy "Kiosk reads active students" on public.students
  for select to anon using (active = true);
create policy "Teachers read assigned active students" on public.students
  for select to authenticated using (active = true and exists (
    select 1 from public.classroom_teachers ct
    where ct.classroom_id = students.classroom_id and ct.teacher_id = auth.uid()
  ));
