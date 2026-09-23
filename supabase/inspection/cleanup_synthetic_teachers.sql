-- Removes ONLY the synthetic rows created by tests/live-rls.mjs for disposable
-- test teachers whose Auth email starts with 'pip-test-'. Real teachers,
-- classrooms, students, and history are untouched because everything is
-- derived from those test accounts' own classroom memberships.
-- Run in Supabase SQL Editor after live verification. Review the counts first.
begin;
create temp table doomed_teachers as
  select id from auth.users where email like 'pip-test-%';
create temp table doomed_classrooms as
  select distinct ct.classroom_id from public.classroom_teachers ct
  join doomed_teachers t on t.id = ct.teacher_id
  where not exists (
    -- Never delete a classroom that a real teacher also belongs to.
    select 1 from public.classroom_teachers other
    where other.classroom_id = ct.classroom_id
      and other.teacher_id not in (select id from doomed_teachers));
select (select count(*) from doomed_teachers) as test_teachers,
       (select count(*) from doomed_classrooms) as test_classrooms,
       (select count(*) from public.students where classroom_id in (select classroom_id from doomed_classrooms)) as test_students;
-- Storage rows cannot be deleted from SQL (storage.protect_delete). The live
-- suite removes its own upload through the Storage API; stop here if any object
-- for a test classroom is still present so nothing is orphaned.
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'student-avatars'
    and split_part(name, '/', 1) in (select classroom_id::text from doomed_classrooms))
  then raise exception 'Test avatar objects remain; remove them through the Storage API first'; end if;
end $$;
delete from public.teacher_responses where teacher_id in (select id from doomed_teachers);
-- Classroom deletion cascades to students, check-ins, responses, and memberships.
delete from public.classrooms where id in (select classroom_id from doomed_classrooms);
delete from public.teacher_profiles where id in (select id from doomed_teachers);
-- Auth users: delete them in Dashboard → Authentication → Users (or uncomment).
-- delete from auth.users where id in (select id from doomed_teachers);
commit;
