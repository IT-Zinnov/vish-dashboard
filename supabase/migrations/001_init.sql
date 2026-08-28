-- Vish Dashboard: multi-tenant schema + RLS
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'platform_admin',
    'team',
    'client_contributor',
    'client_viewer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum (
    'draft',
    'submitted',
    'in_review',
    'published',
    'execution'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  role public.app_role not null default 'client_viewer',
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists invites_email_pending_idx
  on public.invites (lower(email))
  where accepted_at is null;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status public.project_status not null default 'draft',
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.raci_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  workstream text not null,
  responsible text,
  accountable text,
  consulted text,
  informed text,
  sort_order int not null default 0
);

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.projects enable row level security;
alter table public.intakes enable row level security;
alter table public.raci_rows enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('platform_admin', 'team')
  );
$$;

create or replace function public.my_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_team_member()
    or (tenant_id is not null and tenant_id = public.my_tenant_id())
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants
  for select using (
    public.is_team_member()
    or id = public.my_tenant_id()
  );

drop policy if exists "tenants_write_admin" on public.tenants;
create policy "tenants_write_admin" on public.tenants
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "invites_admin" on public.invites;
create policy "invites_admin" on public.invites
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (
    public.is_team_member()
    or tenant_id = public.my_tenant_id()
  );

drop policy if exists "projects_insert_team" on public.projects;
create policy "projects_insert_team" on public.projects
  for insert with check (public.is_team_member());

drop policy if exists "projects_update_team" on public.projects;
create policy "projects_update_team" on public.projects
  for update using (public.is_team_member());

drop policy if exists "projects_update_client_submit" on public.projects;
create policy "projects_update_client_submit" on public.projects
  for update using (
    tenant_id = public.my_tenant_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client_contributor'
    )
    and status in ('draft', 'submitted')
  );

drop policy if exists "intakes_select" on public.intakes;
create policy "intakes_select" on public.intakes
  for select using (
    public.is_team_member()
    or tenant_id = public.my_tenant_id()
  );

drop policy if exists "intakes_write_team" on public.intakes;
create policy "intakes_write_team" on public.intakes
  for all using (public.is_team_member())
  with check (public.is_team_member());

drop policy if exists "intakes_write_contributor_draft" on public.intakes;
create policy "intakes_write_contributor_draft" on public.intakes
  for update using (
    tenant_id = public.my_tenant_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client_contributor'
    )
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.status = 'draft'
    )
  );

drop policy if exists "raci_select" on public.raci_rows;
create policy "raci_select" on public.raci_rows
  for select using (
    public.is_team_member()
    or tenant_id = public.my_tenant_id()
  );

drop policy if exists "raci_write_team" on public.raci_rows;
create policy "raci_write_team" on public.raci_rows
  for all using (public.is_team_member())
  with check (public.is_team_member());

-- First signup becomes platform_admin. Later signups attach via invite email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
  invite_row public.invites%rowtype;
begin
  select count(*) into admin_count from public.profiles where role = 'platform_admin';

  select * into invite_row
  from public.invites
  where accepted_at is null
    and lower(email) = lower(new.email)
  order by created_at desc
  limit 1;

  if admin_count = 0 then
    insert into public.profiles (id, tenant_id, role, full_name, email)
    values (
      new.id,
      null,
      'platform_admin',
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    );
  elsif invite_row.id is not null then
    insert into public.profiles (id, tenant_id, role, full_name, email)
    values (
      new.id,
      invite_row.tenant_id,
      invite_row.role,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    );
    update public.invites set accepted_at = now() where id = invite_row.id;
  else
    insert into public.profiles (id, tenant_id, role, full_name, email)
    values (
      new.id,
      null,
      'client_viewer',
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
