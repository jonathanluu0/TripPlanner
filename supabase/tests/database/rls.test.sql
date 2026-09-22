-- Security tests (pgTAP). Simulates three guests:
--   host      creates the trip
--   friend    joins with the invite code
--   outsider  never joins
-- Run with `supabase test db` (local Supabase) or supabase/tests/run.sh (plain Postgres).
-- Everything happens inside one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- host
  ('00000000-0000-0000-0000-00000000000b'),  -- friend
  ('00000000-0000-0000-0000-00000000000c');  -- outsider

-- Act as a signed-in guest: same JWT claims Supabase sets for a real request.
create function pg_temp.act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'role', 'authenticated',
    'sub', case p_user
      when 'host'     then '00000000-0000-0000-0000-00000000000a'
      when 'friend'   then '00000000-0000-0000-0000-00000000000b'
      when 'outsider' then '00000000-0000-0000-0000-00000000000c'
    end)::text, true);
$$;

-- pgTAP keeps its bookkeeping in temp tables; let the test roles use them.
grant usage on schema extensions to authenticated, anon;
grant all on all tables in schema pg_temp to authenticated, anon;
grant all on all sequences in schema pg_temp to authenticated, anon;
grant execute on all functions in schema pg_temp to authenticated, anon;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Host creates a trip and adds content
-- ---------------------------------------------------------------------------
select pg_temp.act_as('host');

select lives_ok($$ select create_trip('trip1', 'k7q2mx') $$, 'host can create a trip');
select lives_ok($$
  insert into trip_entities (trip_id, kind, id, data) values
    ('trip1', 'meta',   'trip1',  '{"name": "Tahoe"}'),
    ('trip1', 'member', 'm-alex', '{"name": "Alex"}'),
    ('trip1', 'car',    'car1',   '{"label": "Civic"}')
$$, 'host can add trip content');
select is((select count(*)::int from trip_entities where trip_id = 'trip1'), 3, 'host sees their trip content');
select is((select invite_code from trips where id = 'trip1'), 'K7Q2MX', 'invite code is stored uppercase');

-- ---------------------------------------------------------------------------
-- 2. Friend can't see or touch the trip before joining
-- ---------------------------------------------------------------------------
select pg_temp.act_as('friend');

select is((select count(*)::int from trips), 0, 'friend cannot see the trip before joining');
select is((select count(*)::int from trip_entities), 0, 'friend cannot see content before joining');
select throws_ok(
  $$ insert into trip_entities (trip_id, kind, id, data) values ('trip1', 'car', 'hack', '{}') $$,
  '42501', null, 'friend cannot write before joining');

-- ---------------------------------------------------------------------------
-- 3. Friend joins with the code, then reads and writes
-- ---------------------------------------------------------------------------
select is(join_trip(' k7q2mx '), 'trip1', 'join works with a lowercase code and spaces');
select is(join_trip('K7Q2MX'), 'trip1', 'joining twice is harmless');
select is((select count(*)::int from trip_entities where trip_id = 'trip1'), 3, 'friend sees content after joining');

update trip_entities set data = '{"label": "Civic (full)"}' where trip_id = 'trip1' and id = 'car1';
select is((select data ->> 'label' from trip_entities where id = 'car1'), 'Civic (full)', 'friend can edit content');
select is((select updated_by from trip_entities where id = 'car1'),
          '00000000-0000-0000-0000-00000000000b'::uuid, 'edits record who made them');
select is((select count(*)::int from trip_participants where trip_id = 'trip1'), 2, 'friend sees both participants');
select throws_ok($$ select join_trip('NOPE00') $$, 'P0002', null, 'an unknown invite code is rejected');

-- ---------------------------------------------------------------------------
-- 4. Claiming names
-- ---------------------------------------------------------------------------
select lives_ok($$ select claim_member('trip1', 'm-alex') $$, 'friend can claim "Alex"');
select is((select member_id from trip_participants where user_id = '00000000-0000-0000-0000-00000000000b'),
          'm-alex', 'the claim is saved');

select pg_temp.act_as('host');
select throws_ok($$ select claim_member('trip1', 'm-alex') $$, '23505', null, 'a name cannot be claimed twice');

select pg_temp.act_as('friend');
select throws_ok(
  $$ insert into trip_participants (trip_id, user_id) values ('trip1', '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'participants can only be added through join_trip');

-- ---------------------------------------------------------------------------
-- 5. Outsider sees and changes nothing
-- ---------------------------------------------------------------------------
select pg_temp.act_as('outsider');

select is((select count(*)::int from trips), 0, 'outsider sees no trips');
select is((select count(*)::int from trip_entities), 0, 'outsider sees no content');
select is((select count(*)::int from trip_participants), 0, 'outsider sees no participants');

update trip_entities set data = '{}' where trip_id = 'trip1';
delete from trip_entities where trip_id = 'trip1';
select throws_ok($$ select claim_member('trip1', 'm-alex') $$, 'P0001', null, 'outsider cannot claim a name');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('receipts', 'trip1/evil.jpg') $$,
  '42501', null, 'outsider cannot upload receipt photos');

select pg_temp.act_as('friend');
select is((select count(*)::int from trip_entities where trip_id = 'trip1' and data <> '{}'), 3,
          'outsider''s update and delete changed nothing');

-- ---------------------------------------------------------------------------
-- 6. Receipt photos
-- ---------------------------------------------------------------------------
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('receipts', 'trip1/r1.jpg') $$,
                'friend can upload a receipt photo');

select pg_temp.act_as('outsider');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 0,
          'outsider cannot see receipt photos');

-- ---------------------------------------------------------------------------
-- 7. Deleting a trip
-- ---------------------------------------------------------------------------
select pg_temp.act_as('friend');
delete from trips where id = 'trip1';
select is((select count(*)::int from trips where id = 'trip1'), 1, 'only the creator can delete a trip');

select pg_temp.act_as('host');
delete from trips where id = 'trip1';
reset role;
select is((select count(*)::int from trip_entities where trip_id = 'trip1')
        + (select count(*)::int from trip_participants where trip_id = 'trip1'), 0,
          'deleting a trip removes its content and participants');

-- ---------------------------------------------------------------------------
-- 8. Signed-out visitors (anon role) get nothing
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select count(*) from trip_entities $$, '42501', null, 'signed-out visitors cannot read trips');
reset role;

select * from finish();
rollback;
