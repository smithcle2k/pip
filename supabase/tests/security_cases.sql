-- Same adversarial suite on upgraded and fresh databases. Setup is privileged;
-- every assertion below executes with an ordinary browser database role.
insert into auth.users values ('90000000-0000-0000-0000-000000000001','{}'), ('90000000-0000-0000-0000-000000000002','{}');
insert into public.classrooms(id,name,teacher_name) values
 ('91000000-0000-0000-0000-000000000001','Security A','A'),
 ('91000000-0000-0000-0000-000000000002','Security B','B'),
 ('91000000-0000-0000-0000-000000000003','Second A','A');
insert into public.classroom_teachers values
 ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001'),
 ('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001'),
 ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002');
insert into public.students(id,classroom_id,first_name) values
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','A'),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','B');
create function public.test_reject(q text) returns void language plpgsql security invoker as $$
begin
  begin execute q;
  exception when insufficient_privilege or check_violation or foreign_key_violation then return;
  end;
  raise exception 'Expected security rejection: %', q;
end $$;
grant execute on function public.test_reject(text) to anon, authenticated;
-- Malformed existing objects must remain invisible and undeletable, too.
insert into storage.objects values
 (gen_random_uuid(),'student-avatars','wrong/92000000-0000-0000-0000-000000000001/file.webp'),
 (gen_random_uuid(),'student-avatars','91000000-0000-0000-0000-000000000001/92000000-0000-0000-0000-000000000001/short.webp');
set role authenticated;
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000001';
do $$
declare a text := '91000000-0000-0000-0000-000000000001/92000000-0000-0000-0000-000000000001/93000000-0000-0000-0000-000000000001.webp';
  bad text; n integer;
begin
  assert (select count(*)=1 from public.students);
  assert (select count(*)=2 from public.classrooms);
  perform public.test_reject('update public.students set id=gen_random_uuid()');
  perform public.test_reject('update public.students set created_at=now()');
  perform public.test_reject('update public.students set classroom_id=''91000000-0000-0000-0000-000000000003''');
  perform public.test_reject('delete from public.students');
  perform public.test_reject('truncate public.students');
  perform public.test_reject('insert into public.classroom_teachers values (''91000000-0000-0000-0000-000000000002'',auth.uid())');
  perform public.test_reject('insert into public.students(classroom_id,first_name) values (''91000000-0000-0000-0000-000000000002'',''Forbidden'')');
  update public.students set first_name='No' where id='92000000-0000-0000-0000-000000000002';
  get diagnostics n=row_count; assert n=0;
  foreach bad in array array[
    replace(a,'91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002'),
    replace(a,'92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002'),
    replace(a,'93000000-0000-0000-0000-000000000001','short'), a || '/extra', 'https://example.com/x', '../' || a,
    replace(a,'.webp','.png')]
  loop
    perform public.test_reject(format('insert into storage.objects values(gen_random_uuid(),''student-avatars'',%L)',bad));
    perform public.test_reject(format('update public.students set avatar_path=%L',bad));
  end loop;
  perform public.test_reject('update public.students set avatar_url=''https://example.com/photo.jpg''');
  insert into storage.objects values(gen_random_uuid(),'student-avatars',a);
  update public.students set avatar_path=a, first_name='Renamed', updated_at='2000-01-01';
  insert into public.students(id,classroom_id,first_name) values
    ('92000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000001','Sibling');
  perform public.test_reject(format('update public.students set avatar_path=%L where id=''92000000-0000-0000-0000-000000000003''',a));
  assert (select bool_and(updated_at>'2000-01-02') from public.students);
  assert (select count(*)=1 from storage.objects where bucket_id='student-avatars');
  update storage.objects set name=a where bucket_id='student-avatars';
  get diagnostics n=row_count; assert n=0;
  insert into storage.objects values(gen_random_uuid(),'unrelated','free');
  update storage.objects set name='still works' where bucket_id='unrelated';
  get diagnostics n=row_count; assert n=1;
  perform public.test_reject(format('update storage.objects set bucket_id=''student-avatars'',name=%L where bucket_id=''unrelated''',a));
  insert into public.check_ins(id,student_id,emotion) values('94000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','happy');
  perform public.test_reject('insert into public.check_ins(student_id,emotion) values(''92000000-0000-0000-0000-000000000002'',''happy'')');
  perform public.test_reject('insert into public.teacher_responses(student_id,check_in_id,teacher_id,response_type) values(''92000000-0000-0000-0000-000000000001'',''94000000-0000-0000-0000-000000000001'',''90000000-0000-0000-0000-000000000002'',''no_action_needed'')');
  perform public.test_reject('insert into public.teacher_responses(student_id,check_in_id,teacher_id,response_type) values(''92000000-0000-0000-0000-000000000002'',''94000000-0000-0000-0000-000000000001'',auth.uid(),''no_action_needed'')');
  insert into public.teacher_responses(student_id,check_in_id,teacher_id,response_type) values('92000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001',auth.uid(),'no_action_needed');
  update public.students set active=false,avatar_path=null;
  perform public.test_reject('insert into public.check_ins(student_id,emotion) values(''92000000-0000-0000-0000-000000000001'',''happy'')');
  perform public.test_reject('insert into public.teacher_responses(student_id,check_in_id,teacher_id,response_type) values(''92000000-0000-0000-0000-000000000001'',''94000000-0000-0000-0000-000000000001'',auth.uid(),''no_action_needed'')');
  assert (select count(*)=1 from public.check_ins);
  assert (select count(*)=1 from public.teacher_responses);
end $$;
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000002';
do $$ declare n integer; begin
  assert (select count(*)=1 from public.students);
  assert (select count(*)=0 from public.check_ins);
  assert (select count(*)=0 from public.teacher_responses);
  assert (select count(*)=0 from storage.objects where bucket_id='student-avatars');
  delete from storage.objects where bucket_id='student-avatars';
  get diagnostics n=row_count; assert n=0;
end $$;
set role anon;
set request.jwt.claim.sub='';
do $$ begin
  perform public.test_reject('select * from public.students');
  perform public.test_reject('select * from public.classrooms');
  perform public.test_reject('select * from public.teacher_profiles');
  perform public.test_reject('select * from public.classroom_teachers');
  perform public.test_reject('select * from public.check_ins');
  perform public.test_reject('select * from public.teacher_responses');
  perform public.test_reject('insert into public.check_ins(student_id,emotion) values(''92000000-0000-0000-0000-000000000001'',''happy'')');
  assert (select count(*)=0 from storage.objects where bucket_id='student-avatars');
  perform public.test_reject('insert into storage.objects values(gen_random_uuid(),''student-avatars'',''x'')');
  assert (select count(*)=1 from storage.objects where bucket_id='unrelated');
end $$;
set role authenticated;
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000001';
do $$ declare n integer; begin
  delete from storage.objects where bucket_id='student-avatars';
  get diagnostics n=row_count; assert n=1; -- cleanup after detach/deactivation
end $$;
reset role;
drop function public.test_reject(text);
do $$ begin
  assert (select not public and file_size_limit=1048576 and allowed_mime_types=array['image/webp','image/jpeg'] from storage.buckets where id='student-avatars');
end $$;
select 'PASS Milestone 3 ordinary-role classroom, identity, avatar, history, anonymous and unrelated-bucket boundaries';
