-- Backend foundation for the 11-screen CoE workflow.
-- Run after 001_init.sql and 003_ensure_profile.sql.

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'ready'
    check (status in ('queued', 'processing', 'ready', 'approved', 'failed')),
  assumptions jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists recommendations_project_created_idx
  on public.recommendations (project_id, created_at desc);

alter table public.raci_rows
  add column if not exists due_date date,
  add column if not exists status text not null default 'unassigned',
  add column if not exists locked boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_tenant_created_idx
  on public.activity_log (tenant_id, created_at desc);

create table if not exists public.app_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  inputs jsonb not null,
  output jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text,
  industry text,
  location text,
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  image_path text,
  document_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_study_consents (
  id uuid primary key default gen_random_uuid(),
  case_study_id uuid not null references public.case_studies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_version text not null,
  ip_hash text,
  accepted_at timestamptz not null default now(),
  unique (case_study_id, user_id, consent_version)
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  export_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'failed')),
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.recommendations enable row level security;
alter table public.activity_log enable row level security;
alter table public.app_config enable row level security;
alter table public.pricing_scenarios enable row level security;
alter table public.case_studies enable row level security;
alter table public.case_study_consents enable row level security;
alter table public.exports enable row level security;

drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select using (
    public.is_team_member()
    or (
      tenant_id = public.my_tenant_id()
      and status in ('ready', 'approved')
      and exists (
        select 1 from public.projects p
        where p.id = project_id and p.status in ('published', 'execution')
      )
    )
  );

drop policy if exists "recommendations_write_team" on public.recommendations;
create policy "recommendations_write_team" on public.recommendations
  for all using (public.is_team_member())
  with check (public.is_team_member());

drop policy if exists "activity_select" on public.activity_log;
create policy "activity_select" on public.activity_log
  for select using (
    public.is_team_member()
    or tenant_id = public.my_tenant_id()
  );

drop policy if exists "activity_insert_authenticated" on public.activity_log;
create policy "activity_insert_authenticated" on public.activity_log
  for insert with check (
    actor_id = auth.uid()
    and (
      public.is_team_member()
      or tenant_id = public.my_tenant_id()
    )
  );

drop policy if exists "app_config_read" on public.app_config;
create policy "app_config_read" on public.app_config
  for select using (auth.uid() is not null);

drop policy if exists "app_config_write_admin" on public.app_config;
create policy "app_config_write_admin" on public.app_config
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "pricing_select" on public.pricing_scenarios;
create policy "pricing_select" on public.pricing_scenarios
  for select using (
    public.is_team_member()
    or tenant_id = public.my_tenant_id()
  );

drop policy if exists "pricing_write_team" on public.pricing_scenarios;
create policy "pricing_write_team" on public.pricing_scenarios
  for all using (public.is_team_member())
  with check (public.is_team_member());

drop policy if exists "case_studies_read" on public.case_studies;
create policy "case_studies_read" on public.case_studies
  for select using (status = 'published' or public.is_team_member());

drop policy if exists "case_studies_write_admin" on public.case_studies;
create policy "case_studies_write_admin" on public.case_studies
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "consents_select_own" on public.case_study_consents;
create policy "consents_select_own" on public.case_study_consents
  for select using (user_id = auth.uid() or public.is_team_member());

drop policy if exists "consents_insert_own" on public.case_study_consents;
create policy "consents_insert_own" on public.case_study_consents
  for insert with check (user_id = auth.uid());

drop policy if exists "exports_select" on public.exports;
create policy "exports_select" on public.exports
  for select using (
    public.is_team_member()
    or (
      requested_by = auth.uid()
      and (tenant_id is null or tenant_id = public.my_tenant_id())
    )
  );

drop policy if exists "exports_insert" on public.exports;
create policy "exports_insert" on public.exports
  for insert with check (
    requested_by = auth.uid()
    and (
      public.is_team_member()
      or tenant_id = public.my_tenant_id()
    )
  );

insert into public.app_config (config_key, value, description)
values
  (
    'default_ratios',
    '{"workstation":0.72,"meeting_seat":0.11,"cafe_seat":0.10,"collaboration":0.08,"phone_booth":0.02,"sqft_per_seat":80}'::jsonb,
    'Admin-editable workplace defaults'
  ),
  (
    'pricing',
    '{"base_rate_usd_per_fte":400,"re_cost":{"Bangalore":85,"Hyderabad":70,"Pune":65},"fm_cost_per_seat":1800,"it_cost_per_endpoint":1200}'::jsonb,
    'Admin-editable pricing assumptions'
  )
on conflict (config_key) do nothing;

insert into public.case_studies
  (slug, name, city, industry, location, summary, metrics, status)
values
  (
    'ebay',
    'eBay India GCC',
    'Bangalore',
    'eCommerce',
    'Embassy Tech Village · ORR · Bangalore',
    'Multi-phase India GCC workplace delivery.',
    '{"seats":"1,700+","area_sqft":"200k+","commissioned":"2025-08-21","scope":"End-to-End Fit-out"}'::jsonb,
    'published'
  ),
  (
    'meltwater',
    'Meltwater — Hyderabad',
    'Hyderabad',
    'Technology',
    'Aurobindo Orbit · HITECH City · Hyderabad',
    'Technology office workplace delivery.',
    '{"seats":113,"area_sqft":"11,000+","commissioned":"2024-10-01","sector":"Software"}'::jsonb,
    'published'
  )
on conflict (slug) do nothing;
