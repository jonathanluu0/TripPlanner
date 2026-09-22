-- Initial schema: trips, participants, trip contents, and the join/claim functions.
-- Built from supabase/schemas/ (in config.toml's schema_paths order).
--
-- Written to be safe to apply even if the old single-file schema.sql was already
-- run in the SQL Editor: tables/indexes use IF NOT EXISTS, policies/triggers are
-- dropped and recreated, and the realtime step checks before adding.

-- ============================================================================
-- schemas/functions/is_trip_participant.sql
-- ============================================================================

-- is_trip_participant(trip_id): is the signed-in user part of this trip?
--
-- Used by almost every security policy. SECURITY DEFINER so policies can call it
-- without triggering RLS on trip_participants again (which would recurse).
-- Written in plpgsql (not sql) so it can be created before the table it reads;
-- the tables' policies depend on it, so it has to exist first.

create or replace function public.is_trip_participant(p_trip_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from trip_participants
    where trip_id = p_trip_id
      and user_id = auth.uid()
  );
end;
$$;

revoke execute on function public.is_trip_participant(text) from public, anon;
grant execute on function public.is_trip_participant(text) to authenticated;

-- ============================================================================
-- schemas/tables/trips.sql
-- ============================================================================

-- trips: one row per trip. Its contents live in trip_entities.
--
-- Rows are created only through create_trip() so the creator is always added
-- as a participant in the same step.

create table if not exists public.trips (
  id          text primary key,
  invite_code text not null unique,            -- stored uppercase, e.g. K7Q2MX
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.trips enable row level security;

drop policy if exists "trips: participants can read" on public.trips;
create policy "trips: participants can read" on public.trips
  for select to authenticated
  using (public.is_trip_participant(id));

drop policy if exists "trips: creator can delete" on public.trips;
create policy "trips: creator can delete" on public.trips
  for delete to authenticated
  using (created_by = auth.uid());

-- Guests sign in anonymously but still get the "authenticated" role.
-- "anon" (not signed in at all) gets nothing.
revoke all on public.trips from anon;
grant select, delete on public.trips to authenticated;

-- ============================================================================
-- schemas/tables/trip_participants.sql
-- ============================================================================

-- trip_participants: which signed-in users (guests) belong to which trip,
-- and which trip member ("I'm Alex") each one has claimed.
--
-- Read-only for the app: rows are added by create_trip() / join_trip() and
-- changed by claim_member(), so nobody can add themselves without the invite code.

create table if not exists public.trip_participants (
  trip_id   text not null references public.trips (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  member_id text,                                  -- the Member this user claimed, if any
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- A member ("Alex") can be claimed by at most one user per trip.
create unique index if not exists trip_participants_one_claim_per_member
  on public.trip_participants (trip_id, member_id)
  where member_id is not null;

-- "Which trips am I in?" is the most common lookup.
create index if not exists trip_participants_user_idx
  on public.trip_participants (user_id);

alter table public.trip_participants enable row level security;

drop policy if exists "participants: participants can read" on public.trip_participants;
create policy "participants: participants can read" on public.trip_participants
  for select to authenticated
  using (public.is_trip_participant(trip_id));

revoke all on public.trip_participants from anon;
grant select on public.trip_participants to authenticated;

-- ============================================================================
-- schemas/tables/trip_entities.sql
-- ============================================================================

-- trip_entities: a trip's contents, one JSON row per thing.
--
--   kind = meta     trip name, destination, dates (id = the trip id)
--          member   a person on the trip
--          car      a car card
--          spot     a sleeping spot
--          receipt  a receipt
--
-- One row per thing means two friends editing different cars at the same time
-- don't overwrite each other.

create table if not exists public.trip_entities (
  trip_id    text not null references public.trips (id) on delete cascade,
  kind       text not null check (kind in ('meta', 'member', 'car', 'spot', 'receipt')),
  id         text not null,
  data       jsonb not null,
  -- Deletes are "soft" (deleted_at is set) so they reach other devices through
  -- Realtime like any other update: Supabase doesn't filter or permission-check
  -- hard DELETE events, which would leak ids to users outside the trip.
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (trip_id, kind, id)
);

-- Keep updated_at / updated_by accurate on every change.
create or replace function public.touch_trip_entity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trip_entities_touch on public.trip_entities;
create trigger trip_entities_touch
  before update on public.trip_entities
  for each row execute function public.touch_trip_entity();

alter table public.trip_entities enable row level security;

drop policy if exists "entities: participants can read" on public.trip_entities;
create policy "entities: participants can read" on public.trip_entities
  for select to authenticated
  using (public.is_trip_participant(trip_id));

drop policy if exists "entities: participants can insert" on public.trip_entities;
create policy "entities: participants can insert" on public.trip_entities
  for insert to authenticated
  with check (public.is_trip_participant(trip_id));

drop policy if exists "entities: participants can update" on public.trip_entities;
create policy "entities: participants can update" on public.trip_entities
  for update to authenticated
  using (public.is_trip_participant(trip_id))
  with check (public.is_trip_participant(trip_id));

drop policy if exists "entities: participants can delete" on public.trip_entities;
create policy "entities: participants can delete" on public.trip_entities
  for delete to authenticated
  using (public.is_trip_participant(trip_id));

revoke all on public.trip_entities from anon;
grant select, insert, update, delete on public.trip_entities to authenticated;

-- ============================================================================
-- schemas/functions/create_trip.sql
-- ============================================================================

-- create_trip(id, invite_code): create a trip and make the caller its first participant.

create or replace function public.create_trip(p_id text, p_invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to create a trip';
  end if;

  insert into trips (id, invite_code, created_by)
  values (p_id, upper(trim(p_invite_code)), auth.uid());

  insert into trip_participants (trip_id, user_id)
  values (p_id, auth.uid());
end;
$$;

revoke execute on function public.create_trip(text, text) from public, anon;
grant execute on function public.create_trip(text, text) to authenticated;

-- ============================================================================
-- schemas/functions/join_trip.sql
-- ============================================================================

-- join_trip(code): join a trip by its invite code (any letter case, spaces ignored).
-- Returns the trip id. Joining a trip you're already in does nothing.

create or replace function public.join_trip(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id text;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to join a trip';
  end if;

  select id into v_trip_id
  from trips
  where invite_code = upper(trim(p_code));

  if v_trip_id is null then
    raise exception 'No trip found with invite code %', upper(trim(p_code))
      using errcode = 'P0002';  -- no_data_found
  end if;

  insert into trip_participants (trip_id, user_id)
  values (v_trip_id, auth.uid())
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;

-- ============================================================================
-- schemas/functions/claim_member.sql
-- ============================================================================

-- claim_member(trip_id, member_id): link the caller to a trip member ("I'm Alex").
-- Pass null as member_id to un-claim. A name can only be claimed by one person.

create or replace function public.claim_member(p_trip_id text, p_member_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_trip_participant(p_trip_id) then
    raise exception 'Join the trip before claiming a name';
  end if;

  if p_member_id is not null and exists (
    select 1
    from trip_participants
    where trip_id = p_trip_id
      and member_id = p_member_id
      and user_id <> auth.uid()
  ) then
    raise exception 'Someone else has already claimed that name'
      using errcode = '23505';  -- unique_violation
  end if;

  update trip_participants
  set member_id = p_member_id
  where trip_id = p_trip_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.claim_member(text, text) from public, anon;
grant execute on function public.claim_member(text, text) to authenticated;

-- ============================================================================
-- schemas/realtime.sql
-- ============================================================================

-- Realtime: push trip_entities changes to everyone in the trip, live.
-- Supabase still applies the table's RLS, so each user only receives
-- changes for trips they're part of.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_entities'
  ) then
    alter publication supabase_realtime add table public.trip_entities;
  end if;
end;
$$;
