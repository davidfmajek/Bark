-- Covers table RLS on `reviews` / `review_images` and Storage DELETE on `review-media` 

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read basic profile rows for review attribution.
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);

-- Users: signed-in users can create/update/delete only their own profile row.
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

-- Reviews: anyone can read (establishment pages, recent reviews sidebar).
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT USING (true);

-- Reviews: signed-in users insert only for themselves.
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Reviews: users may update/delete only their own rows (e.g. My Reviews page).
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Review images: readable for gallery / public URLs.
DROP POLICY IF EXISTS "review_images_select_all" ON public.review_images;
CREATE POLICY "review_images_select_all" ON public.review_images FOR SELECT USING (true);

-- Review images: insert only for images tied to a review you own.
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

-- Review images: users may delete only their own rows (e.g. My Reviews page).
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

-- Storage `review-media`: DELETE objects under review-images/<review_id>/... only if you own that review.
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



-- Keep `public.review_images` in sync when objects are deleted from `review-media`.
-- This removes stale DB rows if someone deletes files in Storage UI/API.
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

-- Expand review_images mime types. Run once if the table still has the old CHECK.
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