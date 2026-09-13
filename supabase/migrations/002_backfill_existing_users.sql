-- Run this AFTER 001_init.sql, only if you already created auth users
-- before the schema/trigger existed.
--
-- It does three things:
--   1. marks existing users as email-confirmed (dev convenience)
--   2. creates the missing public.profiles row for each auth user
--   3. promotes the oldest account to platform_admin if none exists yet

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

insert into public.profiles (id, tenant_id, role, full_name, email)
select
  u.id,
  null,
  'client_viewer'::public.app_role,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles
set role = 'platform_admin'
where id = (
  select u.id
  from auth.users u
  order by u.created_at asc
  limit 1
)
and not exists (
  select 1 from public.profiles where role = 'platform_admin'
);

select id, email, role, tenant_id from public.profiles order by created_at;
