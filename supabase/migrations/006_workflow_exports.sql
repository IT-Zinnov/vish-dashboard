-- Automatic Intelligence, explicit RACI publication, and private exports.
-- Run after 005_apply_invites_to_existing_users.sql.

alter table public.projects
  add column if not exists raci_published_at timestamptz,
  add column if not exists raci_published_by uuid
    references public.profiles(id) on delete set null;

alter table public.exports
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Profiles and project-stage changes go through validated server/RPC paths.
-- The original broad self-update policy allowed a direct API caller to change
-- their own role; the original client project policy allowed arbitrary project
-- columns to be changed while a project was a draft.
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "projects_update_client_submit" on public.projects;

-- Submitted clients can immediately read generated Intelligence. Publication
-- is still required for RACI and execution-plan visibility.
drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select using (
    public.is_team_member()
    or (
      tenant_id = public.my_tenant_id()
      and status in ('ready', 'approved')
      and exists (
        select 1
        from public.projects p
        where p.id = project_id
          and p.status in ('submitted', 'in_review', 'published', 'execution')
      )
    )
  );

-- RACI is confidential until the delivery team explicitly publishes it.
drop policy if exists "raci_select" on public.raci_rows;
create policy "raci_select" on public.raci_rows
  for select using (
    public.is_team_member()
    or (
      tenant_id = public.my_tenant_id()
      and exists (
        select 1
        from public.projects p
        where p.id = project_id
          and p.raci_published_at is not null
          and p.status in ('published', 'execution')
      )
    )
  );

-- File bytes are written and signed by server-only service-role code.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-exports', 'project-exports', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

