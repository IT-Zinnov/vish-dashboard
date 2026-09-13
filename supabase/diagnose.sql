-- Paste this in the Supabase SQL Editor and press Run.
-- It shows, for every account: whether it is confirmed, whether it has a
-- usable password, and which role the app will give it.
-- No passwords or tokens are revealed.

select
  u.email,
  u.email_confirmed_at is not null                as confirmed,
  coalesce(u.encrypted_password, '') <> ''        as has_password,
  coalesce(p.role::text, 'NO PROFILE ROW')        as app_role,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
