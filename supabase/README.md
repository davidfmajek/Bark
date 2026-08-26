Run these in the Supabase Dashboard → **SQL Editor**, in order:

1. `schema.sql` — enums, tables, review min-length trigger  
2. `auth.sql` — Auth → `public.users` sync trigger  
3. `rls.sql` — RLS policies, storage buckets, and storage policies  

All three are safe to re-run on an existing project.
