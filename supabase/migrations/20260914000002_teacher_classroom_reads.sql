-- Phase 2 follow-up: let a signed-in teacher read the name of classrooms they are assigned to.
-- Anonymous kiosk clients still cannot read classrooms.
drop policy if exists "Teachers read assigned classrooms" on public.classrooms;
create policy "Teachers read assigned classrooms" on public.classrooms
  for select to authenticated using (exists (
    select 1 from public.classroom_teachers ct
    where ct.classroom_id = classrooms.id and ct.teacher_id = auth.uid()
  ));
