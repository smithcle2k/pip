-- Phase 3: teacher-managed students and private avatar object references.
alter table public.students add column if not exists avatar_path text;
create or replace function public.touch_student_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students for each row execute function public.touch_student_updated_at();
create or replace function public.teacher_has_classroom(target_classroom_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$ select exists (select 1 from public.classroom_teachers where classroom_id = target_classroom_id and teacher_id = auth.uid()) $$;
revoke all on function public.teacher_has_classroom(uuid) from public;
grant execute on function public.teacher_has_classroom(uuid) to authenticated;
drop policy if exists "Teachers read assigned active students" on public.students;
drop policy if exists "Kiosk reads active students" on public.students;
create policy "Teachers read assigned students" on public.students for select to authenticated using (public.teacher_has_classroom(classroom_id));
create policy "Teachers create assigned students" on public.students for insert to authenticated with check (active=true and public.teacher_has_classroom(classroom_id));
create policy "Teachers update assigned students" on public.students for update to authenticated using (public.teacher_has_classroom(classroom_id)) with check (public.teacher_has_classroom(classroom_id));
drop policy if exists "Anyone can create check-ins" on public.check_ins;
create policy "Authorized kiosk creates active check-ins" on public.check_ins for insert to authenticated with check (exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id=student_id and s.active and ct.teacher_id=auth.uid()));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('student-avatars','student-avatars',false,1048576, array['image/webp','image/jpeg']) on conflict (id) do update set public=false, file_size_limit=1048576, allowed_mime_types=excluded.allowed_mime_types;
create policy "Teachers read classroom avatars" on storage.objects for select to authenticated using (bucket_id='student-avatars' and exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id::text = split_part(name,'/',2) and ct.teacher_id=auth.uid()));
create policy "Teachers upload classroom avatars" on storage.objects for insert to authenticated with check (bucket_id='student-avatars' and exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id::text = split_part(name,'/',2) and ct.teacher_id=auth.uid()));
create policy "Teachers remove classroom avatars" on storage.objects for delete to authenticated using (bucket_id='student-avatars' and exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id::text = split_part(name,'/',2) and ct.teacher_id=auth.uid()));
