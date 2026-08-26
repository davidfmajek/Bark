-- BARK row-level security, storage buckets, and related policies.
-- Run after schema.sql (and ideally auth.sql). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Admin helper: role = 'admin' is source of truth; is_admin is legacy fallback.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bark_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  BEGIN
    SELECT COALESCE(
      (SELECT (lower(u.role::text) = 'admin' OR u.is_admin IS TRUE)
       FROM public.users u
       WHERE u.user_id = auth.uid()),
      false
    )
    INTO ok;
    RETURN ok;
  EXCEPTION
    WHEN undefined_column THEN
      SELECT COALESCE(
        (SELECT u.is_admin IS TRUE FROM public.users u WHERE u.user_id = auth.uid()),
        false
      )
      INTO ok;
      RETURN ok;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.bark_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bark_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bark_is_admin() TO service_role;

-- Keep is_admin aligned when role is already admin (one-shot / idempotent).
DO $$
BEGIN
  UPDATE public.users
  SET is_admin = TRUE
  WHERE lower(role::text) = 'admin'
    AND is_admin IS NOT TRUE;
EXCEPTION
  WHEN undefined_column THEN
    NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Establishments + hours
-- ---------------------------------------------------------------------------

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "establishments_select_public" ON public.establishments;
CREATE POLICY "establishments_select_public"
  ON public.establishments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "establishments_insert_admin" ON public.establishments;
CREATE POLICY "establishments_insert_admin"
  ON public.establishments FOR INSERT
  TO authenticated
  WITH CHECK (public.bark_is_admin());

DROP POLICY IF EXISTS "establishments_update_admin" ON public.establishments;
CREATE POLICY "establishments_update_admin"
  ON public.establishments FOR UPDATE
  TO authenticated
  USING (public.bark_is_admin())
  WITH CHECK (public.bark_is_admin());

DROP POLICY IF EXISTS "establishments_delete_admin" ON public.establishments;
CREATE POLICY "establishments_delete_admin"
  ON public.establishments FOR DELETE
  TO authenticated
  USING (public.bark_is_admin());

DROP POLICY IF EXISTS "hours_select_public" ON public.hours;
CREATE POLICY "hours_select_public"
  ON public.hours FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "hours_insert_admin" ON public.hours;
CREATE POLICY "hours_insert_admin"
  ON public.hours FOR INSERT
  TO authenticated
  WITH CHECK (public.bark_is_admin());

DROP POLICY IF EXISTS "hours_update_admin" ON public.hours;
CREATE POLICY "hours_update_admin"
  ON public.hours FOR UPDATE
  TO authenticated
  USING (public.bark_is_admin())
  WITH CHECK (public.bark_is_admin());

DROP POLICY IF EXISTS "hours_delete_admin" ON public.hours;
CREATE POLICY "hours_delete_admin"
  ON public.hours FOR DELETE
  TO authenticated
  USING (public.bark_is_admin());

-- ---------------------------------------------------------------------------
-- Users, reviews, review_images
-- ---------------------------------------------------------------------------

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own" ON public.users;
CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "review_images_select_all" ON public.review_images;
CREATE POLICY "review_images_select_all" ON public.review_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "review_images_insert_own_review" ON public.review_images;
CREATE POLICY "review_images_insert_own_review" ON public.review_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.review_id = review_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "review_images_delete_own_review" ON public.review_images;
CREATE POLICY "review_images_delete_own_review" ON public.review_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.review_id = review_id
        AND r.user_id = auth.uid()
    )
  );

-- Expand review_images mime types if an older CHECK is still present.
ALTER TABLE public.review_images DROP CONSTRAINT IF EXISTS review_images_mime_type_check;
ALTER TABLE public.review_images ADD CONSTRAINT review_images_mime_type_check
  CHECK (
    mime_type IN (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-media',
  'review-media',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

-- ---------------------------------------------------------------------------
-- Storage policies: review-media
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "review_media_delete_own_review" ON storage.objects;
CREATE POLICY "review_media_delete_own_review"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'review-media'
    AND split_part(name, '/', 1) = 'review-images'
    AND split_part(name, '/', 2) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.review_id = split_part(name, '/', 2)::uuid
        AND r.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.delete_review_image_row_on_storage_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.bucket_id = 'review-media' THEN
    DELETE FROM public.review_images
    WHERE storage_url = OLD.name
       OR storage_url = '/' || OLD.name
       OR storage_url LIKE '%' || OLD.name || '%';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_storage_review_media_delete_sync ON storage.objects;
CREATE TRIGGER trg_storage_review_media_delete_sync
AFTER DELETE ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.delete_review_image_row_on_storage_delete();

-- ---------------------------------------------------------------------------
-- Storage policies: profile-pic
-- ---------------------------------------------------------------------------

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

DROP POLICY IF EXISTS "profile_media_select_public" ON storage.objects;
CREATE POLICY "profile_media_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-pic');

-- ---------------------------------------------------------------------------
-- Storage policies: Resturant-logos (admin brand images)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "restaurant_logos_admin_insert" ON storage.objects;
CREATE POLICY "restaurant_logos_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'Resturant-logos'
    AND public.bark_is_admin()
  );

DROP POLICY IF EXISTS "restaurant_logos_admin_update" ON storage.objects;
CREATE POLICY "restaurant_logos_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'Resturant-logos'
    AND public.bark_is_admin()
  )
  WITH CHECK (
    bucket_id = 'Resturant-logos'
    AND public.bark_is_admin()
  );

DROP POLICY IF EXISTS "restaurant_logos_admin_delete" ON storage.objects;
CREATE POLICY "restaurant_logos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'Resturant-logos'
    AND public.bark_is_admin()
  );
