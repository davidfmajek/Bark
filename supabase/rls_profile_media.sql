-- Dedicated storage bucket + RLS policies for profile avatars.
-- Run this in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pic',
  'profile-pic',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Upload/update only inside profile-avatars/<auth.uid()>/...
DROP POLICY IF EXISTS "profile_media_insert_own_avatar" ON storage.objects;
CREATE POLICY "profile_media_insert_own_avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pic'
    AND split_part(name, '/', 1) = 'profile-avatars'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile_media_update_own_avatar" ON storage.objects;
CREATE POLICY "profile_media_update_own_avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pic'
    AND split_part(name, '/', 1) = 'profile-avatars'
    AND split_part(name, '/', 2) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-pic'
    AND split_part(name, '/', 1) = 'profile-avatars'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile_media_delete_own_avatar" ON storage.objects;
CREATE POLICY "profile_media_delete_own_avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pic'
    AND split_part(name, '/', 1) = 'profile-avatars'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

-- Optional explicit read policy. (Bucket is public, but this is safe to keep.)
DROP POLICY IF EXISTS "profile_media_select_public" ON storage.objects;
CREATE POLICY "profile_media_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-pic');
