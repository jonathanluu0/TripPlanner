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
