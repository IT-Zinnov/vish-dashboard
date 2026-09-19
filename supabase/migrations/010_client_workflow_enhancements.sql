-- Client workflow enhancements:
-- - contact emails for every RACI role
-- - demo required-space data
-- - staff-only pricing reads
-- Safe to re-run after 009_demo_clients.sql.

alter table public.raci_rows
  add column if not exists responsible_email text,
  add column if not exists accountable_email text,
  add column if not exists consulted_email text,
  add column if not exists informed_email text;

-- Demo contacts are deliberately non-deliverable example addresses.
update public.raci_rows r
set
  responsible_email = coalesce(
    r.responsible_email,
    lower(regexp_replace(r.responsible, '[^a-zA-Z0-9]+', '.', 'g')) || '@demo.example'
  ),
  accountable_email = coalesce(
    r.accountable_email,
    lower(regexp_replace(r.accountable, '[^a-zA-Z0-9]+', '.', 'g')) || '@demo.example'
  ),
  consulted_email = coalesce(
    r.consulted_email,
    lower(regexp_replace(r.consulted, '[^a-zA-Z0-9]+', '.', 'g')) || '@demo.example'
  ),
  informed_email = coalesce(
    r.informed_email,
    lower(regexp_replace(r.informed, '[^a-zA-Z0-9]+', '.', 'g')) || '@demo.example'
  )
from public.projects p
where r.project_id = p.id
  and p.is_demo = true;

update public.intakes i
set payload = i.payload || jsonb_build_object(
  'requiredSpaces',
  jsonb_build_array(
    'Conference Room / Townhall',
    'Focus / Quiet pods',
    'Collaboration / Huddle zones',
    'Cafeteria / Pantry',
    'Reception / Lobby',
    'Server / IT room',
    'Wellness / Mother''s room'
  )
)
from public.projects p
where i.project_id = p.id
  and p.is_demo = true;

-- RACI publication is now the transition into execution; remove the legacy
-- intermediate click for projects that were already published.
update public.projects
set status = 'execution'
where status = 'published'
  and raci_published_at is not null;

drop policy if exists "pricing_select" on public.pricing_scenarios;
create policy "pricing_select" on public.pricing_scenarios
  for select using (public.is_team_member());

drop policy if exists "app_config_read" on public.app_config;
create policy "app_config_read" on public.app_config
  for select using (
    public.is_team_member()
    or (
      auth.uid() is not null
      and config_key <> 'pricing'
    )
  );
