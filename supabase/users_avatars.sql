-- Add avatar fields to public.users so review pages can render profile pictures.
-- Run in Supabase SQL Editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_path TEXT,
  ADD COLUMN IF NOT EXISTS avatar_bucket TEXT;

-- Backfill from auth metadata when available.
UPDATE public.users u
SET
  avatar_url = COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'avatar_url'), ''), u.avatar_url),
  avatar_path = COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'avatar_path'), ''), u.avatar_path),
  avatar_bucket = COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'avatar_bucket'), ''), u.avatar_bucket)
FROM auth.users au
WHERE au.id = u.user_id;
