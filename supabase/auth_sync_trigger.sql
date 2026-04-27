-- Sync new Supabase Auth users into public.users
-- Run in Supabase Dashboard → SQL Editor (after schema.sql).
--
-- Email/password sign-up sends affiliation in metadata on insert → public.users row is created.
-- Google OAuth defers affiliation until step 2 → trigger skips public.users; the app inserts after step 2.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aff affiliation_enum;
  v_display text;
BEGIN
  -- Avoid RLS edge cases when inserting into public.users
  PERFORM set_config('row_security', 'off', true);

  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'public.users sync: auth user % has no email; cannot create profile', NEW.id
      USING ERRCODE = '23502';
  END IF;

  IF (NEW.raw_user_meta_data->>'affiliation') IS NULL
     OR btrim(COALESCE(NEW.raw_user_meta_data->>'affiliation', '')) = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    aff := (NEW.raw_user_meta_data->>'affiliation')::affiliation_enum;
  EXCEPTION
    WHEN invalid_text_representation OR OTHERS THEN
      aff := 'Other';
  END;
  IF aff IS NULL THEN
    aff := 'Other';
  END IF;

  v_display := left(
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    255
  );

  INSERT INTO public.users (
    user_id,
    email,
    password_hash,
    display_name,
    avatar_url,
    avatar_path,
    avatar_bucket,
    affiliation,
    is_admin,
    created_at,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    '[Supabase Auth]',
    v_display,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_path'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_bucket'), ''),
    aff,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.users.display_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.users.avatar_url),
    avatar_path = COALESCE(NULLIF(EXCLUDED.avatar_path, ''), public.users.avatar_path),
    avatar_bucket = COALESCE(NULLIF(EXCLUDED.avatar_bucket, ''), public.users.avatar_bucket),
    affiliation = EXCLUDED.affiliation,
    last_login = EXCLUDED.last_login;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- "PROCEDURE" is the traditional PG name for trigger functions (PG11–13); "FUNCTION" works on PG14+.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_auth_user();

INSERT INTO public.users (
  user_id,
  email,
  password_hash,
  display_name,
  avatar_url,
  avatar_path,
  avatar_bucket,
  affiliation,
  is_admin,
  created_at,
  last_login
)
SELECT
  id,
  email,
  '[Supabase Auth]',
  left(
    COALESCE(
      NULLIF(TRIM(raw_user_meta_data->>'display_name'), ''),
      NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(raw_user_meta_data->>'name'), ''),
      split_part(email, '@', 1)
    ),
    255
  ),
  NULLIF(TRIM(raw_user_meta_data->>'avatar_url'), ''),
  NULLIF(TRIM(raw_user_meta_data->>'avatar_path'), ''),
  NULLIF(TRIM(raw_user_meta_data->>'avatar_bucket'), ''),
  'Other',
  FALSE,
  created_at,
  updated_at
FROM auth.users
WHERE
  raw_user_meta_data->>'affiliation' IS NOT NULL
  AND btrim(COALESCE(raw_user_meta_data->>'affiliation', '')) <> ''
ON CONFLICT (user_id) DO NOTHING;
