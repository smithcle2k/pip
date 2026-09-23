begin;

create table if not exists public.check_in_export_activity (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete restrict,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  time_zone text not null check (char_length(time_zone) between 1 and 100),
  selected_student_ids uuid[] not null,
  include_inactive boolean not null default false,
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists check_in_export_activity_teacher_idx on public.check_in_export_activity(teacher_id, created_at desc);
alter table public.check_in_export_activity enable row level security;
revoke all on public.check_in_export_activity from public, anon, authenticated;

create or replace function public.record_check_in_export(
  p_classroom_id uuid, p_start_date date, p_end_date date, p_time_zone text,
  p_student_ids uuid[], p_include_inactive boolean, p_row_count integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare export_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not public.teacher_has_classroom(p_classroom_id) then raise exception 'Classroom access denied' using errcode = '42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date + 1 > 366 then raise exception 'Invalid export date range' using errcode = '22023'; end if;
  if p_time_zone is null or not exists (select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'Invalid export time zone' using errcode = '22023'; end if;
  if p_end_date > (now() at time zone p_time_zone)::date then raise exception 'Future export date' using errcode = '22023'; end if;
  if p_row_count < 0 or char_length(p_time_zone) > 100 then raise exception 'Invalid export metadata' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_student_ids, '{}'::uuid[])) chosen(id)
    left join public.students s on s.id = chosen.id and s.classroom_id = p_classroom_id
    where s.id is null or (not s.active and not p_include_inactive)) then raise exception 'Student access denied' using errcode = '42501'; end if;
  insert into public.check_in_export_activity(teacher_id, classroom_id, start_date, end_date, time_zone, selected_student_ids, include_inactive, row_count)
    values (auth.uid(), p_classroom_id, p_start_date, p_end_date, p_time_zone, coalesce(p_student_ids, '{}'::uuid[]), p_include_inactive, p_row_count)
    returning id into export_id;
  return export_id;
end; $$;
revoke all on function public.record_check_in_export(uuid,date,date,text,uuid[],boolean,integer) from public, anon, authenticated;
grant execute on function public.record_check_in_export(uuid,date,date,text,uuid[],boolean,integer) to authenticated;

commit;
