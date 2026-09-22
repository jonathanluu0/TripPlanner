-- trip_participants: which signed-in users (guests) belong to which trip,
-- and which trip member ("I'm Alex") each one has claimed.
--
-- Read-only for the app: rows are added by create_trip() / join_trip() and
-- changed by claim_member(), so nobody can add themselves without the invite code.

create table public.trip_participants (
  trip_id   text not null references public.trips (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  member_id text,                                  -- the Member this user claimed, if any
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- A member ("Alex") can be claimed by at most one user per trip.
create unique index trip_participants_one_claim_per_member
  on public.trip_participants (trip_id, member_id)
  where member_id is not null;

-- "Which trips am I in?" is the most common lookup.
create index trip_participants_user_idx
  on public.trip_participants (user_id);

alter table public.trip_participants enable row level security;

create policy "participants: participants can read" on public.trip_participants
  for select to authenticated
  using (public.is_trip_participant(trip_id));

revoke all on public.trip_participants from anon;
grant select on public.trip_participants to authenticated;
