-- Phase 2: classroom membership and private teacher responses.
create table if not exists public.classroom_teachers (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  primary key (classroom_id, teacher_id)
);
alter table public.classroom_teachers enable row level security;
create policy "Teachers read own memberships" on public.classroom_teachers for select to authenticated using (teacher_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'check_ins_id_student_unique') then
    alter table public.check_ins add constraint check_ins_id_student_unique unique (id, student_id);
  end if;
end $$;

create table if not exists public.teacher_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  check_in_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  response_type text not null check (response_type in ('quick_conversation','calm_down_break','movement_break','quiet_space','classroom_activity','no_action_needed')),
  note text check (note is null or char_length(note) <= 250),
  created_at timestamptz not null default now(),
  unique (check_in_id),
  foreign key (check_in_id, student_id) references public.check_ins(id, student_id) on delete cascade
);
create index if not exists teacher_responses_student_idx on public.teacher_responses(student_id, created_at desc);
alter table public.teacher_responses enable row level security;
create policy "Teachers read classroom responses" on public.teacher_responses for select to authenticated using (exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id=teacher_responses.student_id and ct.teacher_id=auth.uid()));
create policy "Teachers create classroom responses" on public.teacher_responses for insert to authenticated with check (teacher_id=auth.uid() and exists (select 1 from public.students s join public.classroom_teachers ct on ct.classroom_id=s.classroom_id where s.id=teacher_responses.student_id and ct.teacher_id=auth.uid()));
