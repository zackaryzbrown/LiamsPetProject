-- =====================================================================
-- Storage buckets and policies
-- Two-bucket model:
--   * pet-uploads  (PRIVATE) — initial uploads. Server-side actions write
--                              here using the service role. Owners can read
--                              their own files; admins can read all.
--   * pet-public   (PUBLIC)  — populated by the approval server action
--                              copying the file from pet-uploads. Served
--                              via public URL on /vote.
-- Path conventions:
--   pet-uploads/<user_id>/<submission_id>.<ext>
--   pet-public/<submission_id>.<ext>
-- File constraints (also enforced server-side):
--   * mime: image/jpeg, image/png, image/webp
--   * size: ≤ 5 MB
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-uploads', 'pet-uploads', false, 5242880,
    array['image/jpeg','image/png','image/webp']),
  ('pet-public',  'pet-public',  true,  5242880,
    array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- pet-uploads (private)
-- Writes are performed by the server (service_role) only; we do not give
-- authenticated users INSERT here so we can guarantee path validation.
-- ---------------------------------------------------------------------
drop policy if exists "pet_uploads_select_owner" on storage.objects;
drop policy if exists "pet_uploads_select_admin" on storage.objects;

-- Path layout: <user_id>/<submission_id>.<ext>  → owner is split_part(name,'/',1)
create policy "pet_uploads_select_owner" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pet-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "pet_uploads_select_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pet-uploads'
    and public.is_admin(auth.uid())
  );

-- ---------------------------------------------------------------------
-- pet-public (public bucket — anon read by virtue of public=true)
-- Writes restricted to service_role only (no policies for insert/update/delete).
-- ---------------------------------------------------------------------
-- (No additional policies needed; bucket.public=true exposes read.)
