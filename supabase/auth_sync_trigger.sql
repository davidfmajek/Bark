-- Sync new Supabase Auth users into public.users
-- Run this in Supabase Dashboard → SQL Editor (after schema.sql).
-- When someone signs up via the app, they are created in auth.users; this trigger
-- copies them into public.users so your app's user table stays in sync.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aff affiliation_enum;
BEGIN
  -- Map metadata affiliation to enum; if custom text (e.g. "Other" with free text), use 'Other'
  BEGIN
    aff := (NEW.raw_user_meta_data->>'affiliation')::affiliation_enum;
  EXCEPTION
    WHEN invalid_text_representation OR OTHERS THEN
      aff := 'Other';
  END;

  INSERT INTO public.users (user_id, email, password_hash, display_name, affiliation, is_admin, created_at, last_login)
  VALUES (
    NEW.id,
    NEW.email,
    '[Supabase Auth]',  -- actual auth is in auth.users; do not duplicate password
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), split_part(NEW.email, '@', 1)),
    aff,
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Drop if exists so re-running this file is safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Optional: backfill existing auth users who signed up before this trigger existed.
-- Uncomment and run once in SQL Editor if you already have users in auth.users but not in public.users.

INSERT INTO public.users (user_id, email, password_hash, display_name, affiliation, is_admin, created_at, last_login)
SELECT
  id,
  email,
  '[Supabase Auth]',
  COALESCE(NULLIF(TRIM(raw_user_meta_data->>'display_name'), ''), split_part(email, '@', 1)),
  'Other',
  FALSE,
  created_at,
  updated_at
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
