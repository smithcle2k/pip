-- Minimal Supabase contracts for isolated PostgreSQL tests, NEVER a deployment file.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
-- Deliberately broad legacy policy: security migration must guard its bucket
-- without breaking unrelated buckets that rely on this policy.
create policy legacy_storage_access on storage.objects for all to public using(true) with check(true);
alter default privileges in schema public grant all on tables to anon, authenticated;
