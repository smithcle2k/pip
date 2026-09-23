-- Read-only metadata report. No user/student records, emails, tokens, or secrets.
-- Run on the intended Pip project before applying the onboarding migration.
begin read only;
select jsonb_pretty(jsonb_build_object(
  'columns', (select jsonb_agg(to_jsonb(c)) from (
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns where table_schema = 'public'
    order by table_name, ordinal_position
  ) c),
  'constraints', (select jsonb_agg(to_jsonb(c)) from (
    select cl.relname as table_name, co.conname, pg_get_constraintdef(co.oid) as definition
    from pg_constraint co join pg_class cl on cl.oid = co.conrelid
    join pg_namespace n on n.oid = cl.relnamespace where n.nspname = 'public'
    order by cl.relname, co.conname
  ) c),
  'rls', (select jsonb_agg(to_jsonb(c)) from (
    select relname, relrowsecurity, relforcerowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ) c),
  'policies', (select jsonb_agg(to_jsonb(p)) from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
  ) p),
  'table_grants', (select jsonb_agg(to_jsonb(g)) from (
    select table_schema, table_name, grantee, privilege_type from information_schema.table_privileges
    where table_schema in ('public','storage') and grantee in ('PUBLIC','anon','authenticated')
  ) g),
  'column_grants', (select jsonb_agg(to_jsonb(g)) from (
    select table_name, column_name, grantee, privilege_type from information_schema.column_privileges
    where table_schema = 'public' and grantee in ('PUBLIC','anon','authenticated')
  ) g),
  'functions', (select jsonb_agg(to_jsonb(f)) from (
    select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer, p.proconfig as settings, p.proacl as grants
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  ) f),
  'avatar_bucket', (select jsonb_agg(to_jsonb(b)) from (
    select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'student-avatars'
  ) b),
  'migration_history_table', to_regclass('supabase_migrations.schema_migrations')
)) as metadata_report;
-- Only migration versions, never stored SQL statements (which can contain data).
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    raise notice 'Applied migration versions: %',
      (select string_agg(version, ', ' order by version) from supabase_migrations.schema_migrations);
  end if;
end $$;
rollback;
