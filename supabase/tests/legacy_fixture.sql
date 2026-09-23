-- Synthetic legacy account with no metadata and an empty classroom.
insert into auth.users values ('00000000-0000-0000-0000-000000000001', '{}');
insert into public.classrooms (id, name, teacher_name) values ('10000000-0000-0000-0000-000000000001', 'Legacy room', 'Legacy display');
insert into public.classroom_teachers values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
