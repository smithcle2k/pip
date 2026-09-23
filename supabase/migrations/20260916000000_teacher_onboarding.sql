-- Apply after the base schema and all four earlier migrations. Never rerun schema.sql.
begin;

create table public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (
    first_name = btrim(first_name) and char_length(first_name) between 1 and 80
    and first_name !~ '[[:cntrl:]]' and first_name ~ '[^[:space:]]'
  ),
  created_at timestamptz not null default now(),
  onboarding_completed_at timestamptz
);
alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from public, anon, authenticated;
grant select, update (first_name) on public.teacher_profiles to authenticated;
create policy "Teachers read own profile" on public.teacher_profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Teachers edit own display name" on public.teacher_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- One-time legacy compatibility: snapshot existing memberships, including empty
-- rosters and multiple memberships. Never infer completion from student counts.
-- A generic display label is used when no valid first_name metadata exists.
-- Metadata is never used for membership or completion authorization.
insert into public.teacher_profiles (id, first_name, onboarding_completed_at)
select u.id,
  case when jsonb_typeof(u.raw_user_meta_data -> 'first_name') = 'string'
    and char_length(btrim(u.raw_user_meta_data ->> 'first_name')) between 1 and 80
    and (u.raw_user_meta_data ->> 'first_name') !~ '[[:cntrl:]]'
    and (u.raw_user_meta_data ->> 'first_name') ~ '[^[:space:]]'
  then btrim(u.raw_user_meta_data ->> 'first_name') else 'Teacher' end,
  case when exists (select 1 from public.classroom_teachers ct where ct.teacher_id = u.id)
    then now() else null end
from auth.users u
on conflict (id) do nothing;

-- Authenticated bootstrap works after email verification; signup needs no session
-- and no Auth trigger. Repeated calls never overwrite names or completion.
create function public.bootstrap_teacher_profile()
returns public.teacher_profiles language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  display_name text;
  profile public.teacher_profiles;
begin
  if caller is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select case when jsonb_typeof(u.raw_user_meta_data -> 'first_name') = 'string'
    then btrim(u.raw_user_meta_data ->> 'first_name') end into display_name
  from auth.users u where u.id = caller;
  if display_name is null or char_length(display_name) not between 1 and 80
    or display_name ~ '[[:cntrl:]]' or display_name !~ '[^[:space:]]'
  then display_name := 'Teacher'; end if;
  insert into public.teacher_profiles (id, first_name) values (caller, display_name)
    on conflict (id) do nothing;
  select * into strict profile from public.teacher_profiles where id = caller;
  return profile;
end;
$$;

-- Display names are not identities. Remove only the legacy pair constraint;
-- never join a classroom by matching its name or its teacher's name.
alter table public.classrooms drop constraint classrooms_name_teacher_name_key;
revoke insert, update, delete, truncate, references, trigger on public.classroom_teachers from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.classrooms from public, anon, authenticated;

create function public.provision_teacher_classroom(classroom_name text)
returns public.classrooms language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  profile public.teacher_profiles;
  room public.classrooms;
  memberships uuid[];
  clean_name text := btrim(classroom_name);
begin
  if caller is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 80
    or clean_name ~ '[[:cntrl:]]' or clean_name !~ '[^[:space:]]'
  then raise exception 'Classroom name must contain 1 to 80 characters' using errcode = '22023'; end if;
  perform public.bootstrap_teacher_profile();
  -- A single durable row serializes retries and two tabs for the same teacher.
  select * into strict profile from public.teacher_profiles where id = caller for update;
  select array_agg(m.classroom_id) into memberships from (
    select classroom_id from public.classroom_teachers where teacher_id = caller for share
  ) m;
  if cardinality(memberships) > 1 then
    raise exception 'Multiple classrooms require administrator assistance' using errcode = 'P0003';
  elsif cardinality(memberships) = 1 then
    select * into strict room from public.classrooms where id = memberships[1];
    return room;
  end if;
  insert into public.classrooms (name, teacher_name) values (clean_name, profile.first_name) returning * into room;
  insert into public.classroom_teachers (classroom_id, teacher_id) values (room.id, caller);
  return room;
end;
$$;

create function public.complete_teacher_onboarding()
returns public.teacher_profiles language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  profile public.teacher_profiles;
  memberships uuid[];
  active_student uuid;
begin
  if caller is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform public.bootstrap_teacher_profile();
  select * into strict profile from public.teacher_profiles where id = caller for update;
  select array_agg(m.classroom_id) into memberships from (
    select classroom_id from public.classroom_teachers where teacher_id = caller for share
  ) m;
  if cardinality(memberships) > 1 then
    raise exception 'Multiple classrooms require administrator assistance' using errcode = 'P0003';
  elsif coalesce(cardinality(memberships), 0) = 0 then
    raise exception 'Create a classroom first' using errcode = '22023';
  end if;
  -- Completion stays complete even if all students are later deactivated.
  if profile.onboarding_completed_at is not null then return profile; end if;
  -- Lock a qualifying row through commit. Concurrent deactivation/deletion or
  -- reassignment waits; if it won first, PostgreSQL rechecks active/membership.
  select id into active_student from public.students
    where classroom_id = memberships[1] and active order by id limit 1 for update;
  if active_student is null then
    raise exception 'Add an active student before finishing setup' using errcode = '22023';
  end if;
  update public.teacher_profiles set onboarding_completed_at = now()
    where id = caller returning * into profile;
  return profile;
end;
$$;

revoke all on function public.bootstrap_teacher_profile() from public, anon, authenticated;
revoke all on function public.provision_teacher_classroom(text) from public, anon, authenticated;
revoke all on function public.complete_teacher_onboarding() from public, anon, authenticated;
grant execute on function public.bootstrap_teacher_profile() to authenticated;
grant execute on function public.provision_teacher_classroom(text) to authenticated;
grant execute on function public.complete_teacher_onboarding() to authenticated;

commit;
