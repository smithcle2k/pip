-- Milestone 3. Forward-only; preserve rows and unrelated Storage buckets.
begin;

-- Replace all effective application policies, including unexpected permissive
-- legacy policies. These six tables belong exclusively to Pip.
do $$
declare p record; c record;
begin
  for p in select tablename, policyname from pg_policies where schemaname='public'
    and tablename in ('teacher_profiles','classrooms','classroom_teachers','students','check_ins','teacher_responses')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
  for p in select unnest(array['teacher_profiles','classrooms','classroom_teachers','students','check_ins','teacher_responses']) as tablename
  loop
    execute format('alter table public.%I enable row level security', p.tablename);
    execute format('revoke all on public.%I from public, anon, authenticated', p.tablename);
    -- Table-level REVOKE does not remove pre-existing column grants.
    for c in select attname from pg_attribute where attrelid=format('public.%I',p.tablename)::regclass and attnum>0 and not attisdropped
    loop execute format('revoke all (%I) on public.%I from public, anon, authenticated', c.attname,p.tablename); end loop;
  end loop;
end $$;

grant select on public.teacher_profiles, public.classrooms, public.classroom_teachers,
  public.students, public.check_ins, public.teacher_responses to authenticated;
grant update(first_name) on public.teacher_profiles to authenticated;
grant insert(id,classroom_id,first_name,active,avatar_path,avatar_url),
  update(first_name,active,avatar_path,avatar_url,updated_at) on public.students to authenticated;
grant insert(id,student_id,emotion) on public.check_ins to authenticated;
grant insert(id,student_id,check_in_id,teacher_id,response_type,note) on public.teacher_responses to authenticated;

create or replace function public.teacher_has_classroom(target_classroom_id uuid)
returns boolean language sql security definer stable set search_path = ''
as $$ select exists (select 1 from public.classroom_teachers ct
  where ct.classroom_id=target_classroom_id and ct.teacher_id=auth.uid()) $$;
revoke all on function public.teacher_has_classroom(uuid) from public, anon, authenticated;
grant execute on function public.teacher_has_classroom(uuid) to authenticated;
revoke all on function public.bootstrap_teacher_profile(), public.provision_teacher_classroom(text), public.complete_teacher_onboarding() from public, anon, authenticated;
grant execute on function public.bootstrap_teacher_profile(), public.provision_teacher_classroom(text), public.complete_teacher_onboarding() to authenticated;

create policy profile_read on public.teacher_profiles for select to authenticated using(id=auth.uid());
create policy profile_edit on public.teacher_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy membership_read on public.classroom_teachers for select to authenticated using(teacher_id=auth.uid());
create policy classroom_read on public.classrooms for select to authenticated using(public.teacher_has_classroom(id));
create policy student_read on public.students for select to authenticated using(public.teacher_has_classroom(classroom_id));
create policy student_create on public.students for insert to authenticated with check(active and public.teacher_has_classroom(classroom_id));
create policy student_edit on public.students for update to authenticated using(public.teacher_has_classroom(classroom_id)) with check(public.teacher_has_classroom(classroom_id));
create policy checkin_read on public.check_ins for select to authenticated using(exists(select 1 from public.students s where s.id=student_id));
create policy checkin_create on public.check_ins for insert to authenticated with check(exists(select 1 from public.students s where s.id=student_id and s.active));
create policy response_read on public.teacher_responses for select to authenticated using(exists(select 1 from public.students s where s.id=student_id));
create policy response_create on public.teacher_responses for insert to authenticated with check(
  teacher_id=auth.uid() and exists(select 1 from public.students s where s.id=student_id and s.active)
  and exists(select 1 from public.check_ins c where c.id=check_in_id and c.student_id=teacher_responses.student_id));

-- Exact canonical UUID segments and a UUID version filename; no extra folders,
-- URLs, traversal, partial UUIDs, or caller-invented classroom/student pairing.
create function public.student_avatar_path_matches(object_name text, classroom uuid, student uuid)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(object_name ~ ('^' || classroom::text || '/' || student::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg)$'), false)
$$;
create function public.can_access_student_avatar(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.students s where
    public.student_avatar_path_matches(object_name,s.classroom_id,s.id)
    and public.teacher_has_classroom(s.classroom_id))
$$;
revoke all on function public.student_avatar_path_matches(text,uuid,uuid), public.can_access_student_avatar(text) from public, anon, authenticated;
grant execute on function public.student_avatar_path_matches(text,uuid,uuid), public.can_access_student_avatar(text) to authenticated;
-- Policy expressions may be evaluated before restrictive guards. This helper
-- reveals only a boolean, always checking the caller's actual membership.
grant execute on function public.can_access_student_avatar(text) to anon;

create function public.guard_student_identity_and_avatar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.classroom_id is distinct from old.classroom_id or new.created_at is distinct from old.created_at) then
    raise exception 'Student identity and classroom are immutable' using errcode='42501';
  end if;
  -- Preserve legacy values without silently discarding photos. Any new or
  -- changed reference must be a private key belonging to this exact student.
  if tg_op='INSERT' or new.avatar_path is distinct from old.avatar_path then
    if new.avatar_path is not null and not public.student_avatar_path_matches(new.avatar_path,new.classroom_id,new.id) then
      raise exception 'Invalid student avatar path' using errcode='23514';
    end if;
  end if;
  if tg_op='INSERT' or new.avatar_url is distinct from old.avatar_url then
    if new.avatar_url is not null then raise exception 'Use private avatar_path' using errcode='23514'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.guard_student_identity_and_avatar() from public, anon, authenticated;
drop trigger if exists students_updated_at on public.students;
create trigger students_identity_avatar before insert or update on public.students
  for each row execute function public.guard_student_identity_and_avatar();
alter function public.touch_student_updated_at() set search_path = '';
revoke all on function public.touch_student_updated_at() from public, anon, authenticated;

update storage.buckets set public=false, file_size_limit=1048576,
  allowed_mime_types=array['image/webp','image/jpeg'] where id='student-avatars';
drop policy if exists "Teachers read classroom avatars" on storage.objects;
drop policy if exists "Teachers upload classroom avatars" on storage.objects;
drop policy if exists "Teachers remove classroom avatars" on storage.objects;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='student-avatars' and public.can_access_student_avatar(name));
create policy avatar_create on storage.objects for insert to authenticated with check(bucket_id='student-avatars' and public.can_access_student_avatar(name));
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='student-avatars' and public.can_access_student_avatar(name));
-- Unknown permissive policies may serve other buckets. Leave them intact but
-- AND these guards into every ordinary client's student-avatar operation.
create policy avatar_read_guard on storage.objects as restrictive for select to public
  using(case when bucket_id='student-avatars' then case when current_user='authenticated' then public.can_access_student_avatar(name) else false end else true end);
create policy avatar_create_guard on storage.objects as restrictive for insert to public
  with check(case when bucket_id='student-avatars' then case when current_user='authenticated' then public.can_access_student_avatar(name) else false end else true end);
create policy avatar_delete_guard on storage.objects as restrictive for delete to public
  using(case when bucket_id='student-avatars' then case when current_user='authenticated' then public.can_access_student_avatar(name) else false end else true end);
create policy avatar_no_update on storage.objects as restrictive for update to public
  using(bucket_id<>'student-avatars') with check(bucket_id<>'student-avatars');
commit;
