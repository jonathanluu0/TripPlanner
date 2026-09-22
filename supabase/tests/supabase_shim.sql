-- Minimal stand-ins for what a real Supabase project already provides, so
-- the migrations can be tested on plain Postgres. NEVER run this on Supabase.

create extension if not exists pgcrypto;
create schema if not exists extensions;  -- Supabase installs extensions (e.g. pgtap) here

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end;
$$;

grant usage on schema public to anon, authenticated;

-- auth: users table + auth.uid() read from the request's JWT "sub" claim.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
create table if not exists auth.users (id uuid primary key);
-- Same logic as Supabase's own auth.uid(): read "sub" from the request's JWT claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- storage: buckets + objects (RLS on, like Supabase) + foldername().
create schema if not exists storage;
grant usage on schema storage to anon, authenticated;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;

-- realtime publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- Supabase grants table access to these roles by default; mimic that so the
-- test proves our explicit revokes (not missing grants) are what protect data.
alter default privileges in schema public grant all on tables to anon, authenticated;
