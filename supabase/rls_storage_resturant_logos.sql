-- storage.objects: admin INSERT/UPDATE/DELETE on bucket Resturant-logos. Run after rls_establishments_hours.sql (bark_is_admin). No SELECT policy here.

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

DROP POLICY IF EXISTS "restaurant_logos_select" ON storage.objects;
