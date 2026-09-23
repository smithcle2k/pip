-- Pip's MVP schema. Run this in Supabase SQL Editor.
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_name text not null,
  created_at timestamptz not null default now(),
  unique (name, teacher_name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  emotion text not null check (emotion in ('happy', 'tired', 'mad', 'sad', 'silly', 'sick')),
  created_at timestamptz not null default now()
);

create index if not exists check_ins_created_at_idx on public.check_ins(created_at desc);
create index if not exists check_ins_student_id_idx on public.check_ins(student_id);

alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.check_ins enable row level security;

-- The kiosk needs to read active students and create check-ins with the anon key.
drop policy if exists "Anyone can read check-ins" on public.check_ins;
drop policy if exists "Authenticated teachers can read check-ins" on public.check_ins;
create policy "Anyone can read active students" on public.students for select using (active = true);
create policy "Anyone can create check-ins" on public.check_ins for insert with check (true);
create policy "Authenticated teachers can read check-ins" on public.check_ins for select to authenticated using (true);
