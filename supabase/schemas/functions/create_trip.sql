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
