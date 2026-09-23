-- Scope check-ins and teacher responses to the caller's classroom.
-- Forward-only security fix for the policies introduced by
-- 20260916000001_classroom_security.sql.
begin;

drop policy if exists checkin_read on public.check_ins;
drop policy if exists checkin_create on public.check_ins;
drop policy if exists response_read on public.teacher_responses;
drop policy if exists response_create on public.teacher_responses;

create policy checkin_read on public.check_ins for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_id
      and public.teacher_has_classroom(s.classroom_id)
  ));

create policy checkin_create on public.check_ins for insert to authenticated
  with check (exists (
    select 1 from public.students s
    where s.id = student_id
      and s.active
      and public.teacher_has_classroom(s.classroom_id)
  ));

create policy response_read on public.teacher_responses for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_id
      and public.teacher_has_classroom(s.classroom_id)
  ));

create policy response_create on public.teacher_responses for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.students s
      where s.id = student_id
        and s.active
        and public.teacher_has_classroom(s.classroom_id)
    )
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id
        and c.student_id = teacher_responses.student_id
    )
  );

commit;
