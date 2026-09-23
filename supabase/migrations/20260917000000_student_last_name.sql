-- MVP: students are identified by first and last name instead of photos.
-- Forward-only; existing rows keep an empty last name until a teacher edits them.
-- Avatar columns and the student-avatars bucket are left in place (no UI uses them).
begin;
alter table public.students add column if not exists last_name text not null default '';
alter table public.students drop constraint if exists students_last_name_check;
alter table public.students add constraint students_last_name_check check (
  last_name = btrim(last_name) and char_length(last_name) <= 80 and last_name !~ '[[:cntrl:]]'
);
grant insert(last_name), update(last_name) on public.students to authenticated;
commit;
