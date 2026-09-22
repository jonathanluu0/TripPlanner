-- Receipt photos: a private storage bucket, readable/writable only by the trip's participants.
--
-- Hand-written: the declarative schema can't describe storage buckets (a bucket is
-- a data row, not a schema object), so this lives only as a migration.
--
-- Files are stored at  receipts/<trip id>/<receipt id>.jpg ; the first folder
-- name decides which trip a photo belongs to.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "receipts: participants can read" on storage.objects;
create policy "receipts: participants can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_trip_participant((storage.foldername(name))[1]));

drop policy if exists "receipts: participants can upload" on storage.objects;
create policy "receipts: participants can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_trip_participant((storage.foldername(name))[1]));

drop policy if exists "receipts: participants can replace" on storage.objects;
create policy "receipts: participants can replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and public.is_trip_participant((storage.foldername(name))[1]))
  with check (bucket_id = 'receipts' and public.is_trip_participant((storage.foldername(name))[1]));

drop policy if exists "receipts: participants can delete" on storage.objects;
create policy "receipts: participants can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.is_trip_participant((storage.foldername(name))[1]));
