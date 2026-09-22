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

create table public.trip_entities (
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

create trigger trip_entities_touch
  before update on public.trip_entities
  for each row execute function public.touch_trip_entity();

alter table public.trip_entities enable row level security;

create policy "entities: participants can read" on public.trip_entities
  for select to authenticated
  using (public.is_trip_participant(trip_id));

create policy "entities: participants can insert" on public.trip_entities
  for insert to authenticated
  with check (public.is_trip_participant(trip_id));

create policy "entities: participants can update" on public.trip_entities
  for update to authenticated
  using (public.is_trip_participant(trip_id))
  with check (public.is_trip_participant(trip_id));

create policy "entities: participants can delete" on public.trip_entities
  for delete to authenticated
  using (public.is_trip_participant(trip_id));

revoke all on public.trip_entities from anon;
grant select, insert, update, delete on public.trip_entities to authenticated;
