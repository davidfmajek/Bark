-- Establishments + hours: public SELECT; INSERT/UPDATE/DELETE require bark_is_admin().

CREATE OR REPLACE FUNCTION public.bark_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_admin IS TRUE FROM public.users u WHERE u.user_id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.bark_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bark_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bark_is_admin() TO service_role;

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
