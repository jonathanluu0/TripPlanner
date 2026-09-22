-- Realtime: push trip_entities changes to everyone in the trip, live.
-- Supabase still applies the table's RLS, so each user only receives
-- changes for trips they're part of.

alter publication supabase_realtime add table public.trip_entities;
