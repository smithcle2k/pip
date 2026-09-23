-- Run after schema.sql. Safe to run again for the same classroom.
with room as (
  insert into public.classrooms (name, teacher_name)
  values ('Room 4', 'Ms. Rivera')
  on conflict (name, teacher_name) do nothing
  returning id
), selected_room as (
  select id from room
  union all
  select id from public.classrooms where name = 'Room 4' and teacher_name = 'Ms. Rivera' limit 1
)
insert into public.students (classroom_id, first_name)
select selected_room.id, demo.first_name
from selected_room
cross join (values ('Chloe'), ('Daniel'), ('Ethan'), ('Liam'), ('Maya'), ('Sophia')) as demo(first_name)
where not exists (
  select 1 from public.students s
  where s.classroom_id = selected_room.id and s.first_name = demo.first_name
);
