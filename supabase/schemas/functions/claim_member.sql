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
