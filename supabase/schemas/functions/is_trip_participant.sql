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
