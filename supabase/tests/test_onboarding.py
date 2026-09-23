"""Run with python3 supabase/tests/test_onboarding.py. Requires Docker.
Uses a disposable PostgreSQL 16 container, no ports, credentials, or live data.
"""
from pathlib import Path
import concurrent.futures
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
CONTAINER = 'pip-onboarding-' + uuid.uuid4().hex[:10]
DATABASE = 'postgres'

def sql(query, ok=True):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-U', 'postgres', '-d', DATABASE, '-v', 'ON_ERROR_STOP=1', '-At'], input=query, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok and not result.returncode:
        raise AssertionError('Expected rejection: ' + query)
    return result.stdout.strip(), result.stderr

def file(path):
    return sql((ROOT / path).read_text())

def uid(number):
    return f'00000000-0000-0000-0000-{number:012d}'

def as_teacher(number, query, ok=True):
    return sql(f"set role authenticated; set request.jwt.claim.sub='{uid(number)}'; {query}", ok)

def scalar(number, query):
    return as_teacher(number, query)[0].splitlines()[-1]

def denied(number, query):
    _, error = as_teacher(number, query, False)
    assert 'permission denied' in error, error

try:
    subprocess.run(['docker', 'run', '--detach', '--rm', '--name', CONTAINER, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'], check=True, capture_output=True)
    # The official image starts a temporary server during first-run init and then
    # restarts; wait for two consecutive successful queries on the real server.
    stable = 0
    for attempt in range(240):
        probe = subprocess.run(['docker', 'exec', CONTAINER, 'psql', '-X', '-U', 'postgres', '-d', DATABASE, '-Atc', 'select 1'], capture_output=True)
        stable = stable + 1 if probe.returncode == 0 else 0
        if stable >= 2:
            break
        time.sleep(.5)
    else:
        raise AssertionError('PostgreSQL container did not become ready')
    file('supabase/tests/local_fixture.sql')
    file('supabase/schema.sql')
    migrations = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
    onboarding = ROOT / 'supabase/migrations/20260916000000_teacher_onboarding.sql'
    for migration in migrations:
        if migration >= onboarding:
            break
        file(migration)
    file('supabase/tests/legacy_fixture.sql')
    for migration in migrations:
        if migration >= onboarding:
            if migration.name == '20260916000001_classroom_security.sql':
                sql("""
                  create policy unexpected_student_access on public.students for all to public using(true) with check(true);
                  create policy unexpected_profile_access on public.teacher_profiles for all to public using(true) with check(true);
                  grant update(id,classroom_id,created_at) on public.students to authenticated;
                  grant update(onboarding_completed_at) on public.teacher_profiles to authenticated;
                  grant execute on function public.bootstrap_teacher_profile(), public.provision_teacher_classroom(text), public.complete_teacher_onboarding() to public, anon;
                  create policy unexpected_membership_access on public.classroom_teachers for all to public using(true) with check(true);
                """)
            file(migration)
    assert scalar(1, 'select first_name from public.teacher_profiles') == 'Teacher'
    assert scalar(1, 'select onboarding_completed_at is not null from public.teacher_profiles') == 't'
    assert scalar(1, 'select count(*) from public.students') == '0'
    print('PASS legacy membership with empty roster stays complete; no name inferred')

    for n in range(2, 9):
        metadata = '{"first_name":"  Sarah  ","onboarding_completed_at":"2000-01-01","role":"admin"}'
        if n == 4:
            metadata = '{"first_name":{"bad":"input"}}'
        sql(f"insert into auth.users values ('{uid(n)}', '{metadata}');")
    assert scalar(2, 'select count(*) from public.teacher_profiles') == '0'
    assert scalar(2, 'select first_name from public.bootstrap_teacher_profile()') == 'Sarah'
    assert scalar(2, 'select onboarding_completed_at is null from public.bootstrap_teacher_profile()') == 't'
    assert scalar(4, 'select first_name from public.bootstrap_teacher_profile()') == 'Teacher'
    as_teacher(2, "update public.teacher_profiles set first_name='Sam'")
    assert scalar(2, 'select first_name from public.bootstrap_teacher_profile()') == 'Sam'
    denied(2, 'update public.teacher_profiles set onboarding_completed_at=now()')
    denied(2, f"insert into public.teacher_profiles(id, first_name) values ('{uid(3)}', 'Fake')")
    as_teacher(2, "update public.teacher_profiles set first_name='   '", False)
    as_teacher(2, "update public.teacher_profiles set first_name=repeat('x',81)", False)
    assert scalar(3, 'select count(*) from public.teacher_profiles') == '0'
    for function in ['bootstrap_teacher_profile()', "provision_teacher_classroom('Room 4')", 'complete_teacher_onboarding()']:
        _, error = sql('set role anon; select public.' + function, False)
        assert 'permission denied' in error
        sql("set role authenticated; set request.jwt.claim.sub=''; select public." + function, False)
    print('PASS bootstrap after session, retries, invalid metadata, RLS and completion write protection')

    as_teacher(2, 'select public.complete_teacher_onboarding()', False)
    for name in ["null", "''", "'   '", "repeat('x',81)", "E'\\n'"]:
        as_teacher(2, f'select public.provision_teacher_classroom({name})', False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        rooms = list(pool.map(lambda _: scalar(2, "select id from public.provision_teacher_classroom('Room 4')"), range(2)))
    assert rooms[0] == rooms[1]
    room = rooms[0]
    assert scalar(2, "select id from public.provision_teacher_classroom('A retry name')") == room
    as_teacher(3, "select public.bootstrap_teacher_profile(); update public.teacher_profiles set first_name='Sam'")
    other_room = scalar(3, "select id from public.provision_teacher_classroom('Room 4')")
    assert other_room != room
    assert scalar(2, 'select count(*) from public.classroom_teachers') == '1'
    denied(2, f"insert into public.classroom_teachers values ('{other_room}', '{uid(2)}')")
    denied(2, "insert into public.classrooms(name,teacher_name) values ('X','X')")
    print('PASS concurrent provisioning, retry identity, same display names, no self-enrollment')

    # Force the second insert to fail and ensure the first insert rolls back too.
    sql("create function public.test_fail_membership() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end $$; create trigger test_fail before insert on public.classroom_teachers for each row execute function public.test_fail_membership();")
    before = sql('select count(*) from public.classrooms')[0]
    as_teacher(4, "select public.provision_teacher_classroom('Must roll back')", False)
    assert sql('select count(*) from public.classrooms')[0] == before
    sql('drop trigger test_fail on public.classroom_teachers; drop function public.test_fail_membership();')
    print('PASS classroom and membership are atomic on failure')

    as_teacher(2, 'select public.complete_teacher_onboarding()', False)
    as_teacher(2, f"insert into public.students(classroom_id,first_name) values ('{room}','Test child')")
    student = scalar(2, 'select id from public.students limit 1')
    as_teacher(2, f"update public.students set active=false where id='{student}'")
    as_teacher(2, 'select public.complete_teacher_onboarding()', False)
    as_teacher(2, f"update public.students set active=true where id='{student}'")
    completed = scalar(2, 'select onboarding_completed_at from public.complete_teacher_onboarding()')
    as_teacher(2, f"update public.students set active=false where id='{student}'")
    assert scalar(2, 'select onboarding_completed_at from public.complete_teacher_onboarding()') == completed
    assert scalar(3, 'select onboarding_completed_at is null from public.teacher_profiles') == 't'
    sql(f"insert into public.classroom_teachers values ('{other_room}', '{uid(2)}')")
    for fn in ["provision_teacher_classroom('Ignored')", 'complete_teacher_onboarding()']:
        _, error = as_teacher(2, 'select public.' + fn, False)
        assert 'Multiple classrooms' in error
    assert scalar(2, 'select count(*) from public.classroom_teachers') == '2'
    print('PASS completion prerequisites, idempotence after empty roster, multiple memberships preserved')

    # Real separate database connections: deactivation wins first; completion
    # waits on the row and must reject the now-inactive student.
    race_room = scalar(5, "select id from public.provision_teacher_classroom('Race')")
    as_teacher(5, f"insert into public.students(classroom_id,first_name) values ('{race_room}','Race child')")
    race_student = scalar(5, 'select id from public.students limit 1')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending = pool.submit(as_teacher, 5, f"begin; update public.students set active=false where id='{race_student}'; select pg_sleep(2); commit;")
        # Wait for the actual row-changing transaction to reach its sleep.
        for attempt in range(100):
            sleeping = sql("select count(*) from pg_stat_activity where wait_event='PgSleep' and pid<>pg_backend_pid()")[0]
            if sleeping == '1': break
            time.sleep(.02)
        else: raise AssertionError('Race transaction did not start')
        _, error = as_teacher(5, 'select public.complete_teacher_onboarding()', False)
        assert 'Add an active student' in error
        pending.result()
    assert scalar(5, 'select onboarding_completed_at is null from public.teacher_profiles') == 't'
    print('PASS completion coordinates with concurrent student deactivation')
    file('supabase/tests/security_cases.sql')
    print('PASS upgrade Milestone 3 adversarial ordinary-role security suite (including unexpected legacy policies/grants)')
    file('supabase/inspection/onboarding_preflight.sql')
    sql('create database pip_fresh')
    DATABASE = 'pip_fresh'
    fixture = (ROOT / 'supabase/tests/local_fixture.sql').read_text()
    sql(fixture.replace('create role anon nologin;', '').replace('create role authenticated nologin;', ''))
    file('supabase/schema.sql')
    file('supabase/seed.sql')
    for migration in migrations:
        file(migration)
    assert sql('select count(*) from public.students')[0] == '6'
    assert sql('select count(*) from public.teacher_profiles')[0] == '0'
    sql(f"insert into auth.users values ('{uid(8)}', '{{}}')")
    fresh_room = scalar(8, "select id from public.provision_teacher_classroom('Room 4')")
    assert scalar(8, 'select count(*) from public.students') == '0'
    assert scalar(8, 'select onboarding_completed_at is null from public.teacher_profiles') == 't'
    print('PASS fresh schema + optional legacy seed + all migrations; new teacher never claims seed classroom')
    file('supabase/tests/security_cases.sql')
    print('PASS fresh Milestone 3 adversarial ordinary-role security suite')
    print('All local database tests passed (synthetic auth roles; not live API/email/Storage verification).')
finally:
    subprocess.run(['docker', 'stop', CONTAINER], capture_output=True)
