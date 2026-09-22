-- trips: one row per trip. Its contents live in trip_entities.
--
-- Rows are created only through create_trip() so the creator is always added
-- as a participant in the same step.

create table public.trips (
  id          text primary key,
  invite_code text not null unique,            -- stored uppercase, e.g. K7Q2MX
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.trips enable row level security;

create policy "trips: participants can read" on public.trips
  for select to authenticated
  using (public.is_trip_participant(id));

create policy "trips: creator can delete" on public.trips
  for delete to authenticated
  using (created_by = auth.uid());

-- Guests sign in anonymously but still get the "authenticated" role.
-- "anon" (not signed in at all) gets nothing.
revoke all on public.trips from anon;
grant select, delete on public.trips to authenticated;
