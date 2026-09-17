-- Administrative lifecycle controls.
-- Run after 006_workflow_exports.sql.

alter table public.profiles
  add column if not exists access_revoked_at timestamptz,
  add column if not exists access_revoked_by uuid
    references public.profiles(id) on delete set null;

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists profiles_access_revoked_idx
  on public.profiles (access_revoked_at)
  where access_revoked_at is not null;

