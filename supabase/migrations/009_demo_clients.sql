-- Permanent, reusable demonstration clients.
--
-- These live alongside real clients so a demo can be shown at any time, not
-- only while the workspace is empty. They are flagged with is_demo so the
-- dashboard can label them and keep them out of real portfolio counts.
--
-- Safe to re-run: it restores the seeded state if a demo was edited.
-- Run after 008_cleanup_demo_and_deleted_accounts.sql.

alter table public.tenants
  add column if not exists is_demo boolean not null default false;

alter table public.projects
  add column if not exists is_demo boolean not null default false;

do $$
declare
  t_id uuid;
  p_id uuid;
  i_id uuid;
begin
  ---------------------------------------------------------------------------
  -- Demo 1: Fortune 500 E-commerce Company - India GCC
  ---------------------------------------------------------------------------
  insert into public.tenants (name, slug, status, is_demo)
  values (
    'Fortune 500 E-commerce Company',
    'demo-fortune-500-ecommerce',
    'active',
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        status = 'active',
        is_demo = true
  returning id into t_id;

  select id into p_id
  from public.projects
  where tenant_id = t_id and name = 'India GCC';

  if p_id is null then
    insert into public.projects (
      tenant_id, name, status, submitted_at, published_at, raci_published_at, is_demo
    )
    values (
      t_id,
      'India GCC',
      'published',
      now() - interval '9 days',
      now() - interval '6 days',
      now() - interval '6 days',
      true
    )
    returning id into p_id;
  else
    update public.projects
       set status = 'published',
           is_demo = true,
           submitted_at = coalesce(submitted_at, now() - interval '9 days'),
           published_at = coalesce(published_at, now() - interval '6 days'),
           raci_published_at = coalesce(raci_published_at, now() - interval '6 days')
     where id = p_id;
  end if;

  insert into public.intakes (tenant_id, project_id, payload)
  values (
    t_id,
    p_id,
    jsonb_build_object(
      'org', 'Fortune 500 E-commerce Company',
      'parent', 'Global E-commerce Group',
      'industry', 'eCommerce',
      'requestType', 'New setup',
      'contactName', 'Demo Programme Sponsor',
      'contactEmail', 'programme.sponsor@demo.example',
      'objective', 'Stand up an India GCC for engineering, product and customer operations.',
      'officeType', 'IT Delivery Center / GCC',
      'workModel', 'Hybrid',
      'hours', 'Extended hours (8-10)',
      'primaryFn', 'Engineering / R&D',
      'phasedOcc', 'Yes - Interim / Temp Space',
      'hc1', 500,
      'hc3', 575,
      'hc6', 650,
      'hc12', 750,
      'hc24', 850,
      'density', 100,
      'workspaceStyle', 'Activity-based',
      'kickoff', '2026-01',
      'golive', '2026-06',
      'urgency', 'Standard',
      'deviceType', 'Laptop',
      'devices', 525
    )
  )
  on conflict (project_id) do update
    set payload = excluded.payload,
        updated_at = now();

  select id into i_id from public.intakes where project_id = p_id;

  insert into public.recommendations (
    tenant_id, project_id, intake_id, version, status, assumptions, output, approved_at
  )
  values (
    t_id,
    p_id,
    i_id,
    1,
    'approved',
    '{}'::jsonb,
    jsonb_build_object(
      'methodologyVersion', 'deterministic-v1',
      'generatedAt', to_char(now() - interval '6 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'basis', jsonb_build_object(
        'officeType', 'IT Delivery Center / GCC',
        'headcount', 500,
        'month24Headcount', 850,
        'density', 100
      ),
      'workplace', jsonb_build_object(
        'workstations', 500,
        'meetingRooms', 27,
        'meetingSeats', 160,
        'collaborationSeats', 100,
        'cafeSeats', 100,
        'dayOneAreaSqft', 50000,
        'month24AreaSqft', 85000,
        'deskShare', 1,
        'utilizationTarget', 65,
        'benchmarkAreaRange', jsonb_build_array(90, 125)
      ),
      'infrastructure', jsonb_build_object(
        'devices', 525,
        'estimatedCablingPorts', 600,
        'estimatedCableMetres', 18000,
        'estimatedServerRacks', 2
      ),
      'schedule', jsonb_build_object('kickoff', '2026-01', 'goLive', '2026-06'),
      'risks', jsonb_build_array()
    ),
    now() - interval '6 days'
  )
  on conflict (project_id, version) do update
    set status = 'approved',
        output = excluded.output,
        approved_at = excluded.approved_at,
        updated_at = now();

  delete from public.raci_rows where project_id = p_id;
  insert into public.raci_rows (
    tenant_id, project_id, workstream, responsible, accountable,
    consulted, informed, sort_order, status
  )
  values
    (t_id, p_id, 'Real Estate Strategy', 'RE Programme Lead', 'Executive Sponsor', 'Design Partner', 'Finance', 0, 'completed'),
    (t_id, p_id, 'Design & Build', 'Workplace Delivery Lead', 'RE Programme Lead', 'Fit-out Vendors', 'IT Team', 1, 'in_progress'),
    (t_id, p_id, 'IT Infrastructure', 'IT Infrastructure Lead', 'Technology Sponsor', 'Security', 'Facilities', 2, 'in_progress'),
    (t_id, p_id, 'Facilities Management', 'Facilities Lead', 'RE Programme Lead', 'RE Lead', 'Client Stakeholders', 3, 'assigned'),
    (t_id, p_id, 'Change & Communications', 'Change Lead', 'HR Sponsor', 'HR Business Partners', 'All Staff', 4, 'assigned');

  ---------------------------------------------------------------------------
  -- Demo 2: Global Media Intelligence Company - Hyderabad
  ---------------------------------------------------------------------------
  insert into public.tenants (name, slug, status, is_demo)
  values (
    'Global Media Intelligence Company',
    'demo-global-media-intelligence',
    'active',
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        status = 'active',
        is_demo = true
  returning id into t_id;

  select id into p_id
  from public.projects
  where tenant_id = t_id and name = 'Hyderabad Delivery Centre';

  if p_id is null then
    insert into public.projects (
      tenant_id, name, status, submitted_at, published_at, raci_published_at, is_demo
    )
    values (
      t_id,
      'Hyderabad Delivery Centre',
      'execution',
      now() - interval '20 days',
      now() - interval '14 days',
      now() - interval '14 days',
      true
    )
    returning id into p_id;
  else
    update public.projects
       set status = 'execution',
           is_demo = true,
           submitted_at = coalesce(submitted_at, now() - interval '20 days'),
           published_at = coalesce(published_at, now() - interval '14 days'),
           raci_published_at = coalesce(raci_published_at, now() - interval '14 days')
     where id = p_id;
  end if;

  insert into public.intakes (tenant_id, project_id, payload)
  values (
    t_id,
    p_id,
    jsonb_build_object(
      'org', 'Global Media Intelligence Company',
      'parent', 'Global Media Intelligence Group',
      'industry', 'Technology',
      'requestType', 'New setup',
      'contactName', 'Demo Workplace Lead',
      'contactEmail', 'workplace.lead@demo.example',
      'objective', 'Consolidate Hyderabad teams into a single collaboration-led office.',
      'officeType', 'Corporate Office / HQ',
      'workModel', 'Hybrid',
      'hours', 'Standard business hours (9-6)',
      'primaryFn', 'Product Management',
      'phasedOcc', 'No - Single Move',
      'hc1', 120,
      'hc3', 140,
      'hc6', 160,
      'hc12', 180,
      'hc24', 200,
      'density', 95,
      'workspaceStyle', 'Collaboration-led',
      'kickoff', '2026-02',
      'golive', '2026-07',
      'urgency', 'Standard',
      'deviceType', 'Laptop',
      'devices', 130
    )
  )
  on conflict (project_id) do update
    set payload = excluded.payload,
        updated_at = now();

  select id into i_id from public.intakes where project_id = p_id;

  insert into public.recommendations (
    tenant_id, project_id, intake_id, version, status, assumptions, output, approved_at
  )
  values (
    t_id,
    p_id,
    i_id,
    1,
    'approved',
    '{}'::jsonb,
    jsonb_build_object(
      'methodologyVersion', 'deterministic-v1',
      'generatedAt', to_char(now() - interval '14 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'basis', jsonb_build_object(
        'officeType', 'Corporate Office / HQ',
        'headcount', 120,
        'month24Headcount', 200,
        'density', 95
      ),
      'workplace', jsonb_build_object(
        'workstations', 102,
        'meetingRooms', 4,
        'meetingSeats', 26,
        'collaborationSeats', 13,
        'cafeSeats', 16,
        'dayOneAreaSqft', 11400,
        'month24AreaSqft', 19000,
        'deskShare', 0.85,
        'utilizationTarget', 67,
        'benchmarkAreaRange', jsonb_build_array(125, 200)
      ),
      'infrastructure', jsonb_build_object(
        'devices', 130,
        'estimatedCablingPorts', 144,
        'estimatedCableMetres', 4320,
        'estimatedServerRacks', 1
      ),
      'schedule', jsonb_build_object('kickoff', '2026-02', 'goLive', '2026-07'),
      'risks', jsonb_build_array(
        'Selected density is tighter than the benchmark range.'
      )
    ),
    now() - interval '14 days'
  )
  on conflict (project_id, version) do update
    set status = 'approved',
        output = excluded.output,
        approved_at = excluded.approved_at,
        updated_at = now();

  delete from public.raci_rows where project_id = p_id;
  insert into public.raci_rows (
    tenant_id, project_id, workstream, responsible, accountable,
    consulted, informed, sort_order, status
  )
  values
    (t_id, p_id, 'Real Estate Strategy', 'RE Programme Lead', 'Executive Sponsor', 'Design Partner', 'Finance', 0, 'completed'),
    (t_id, p_id, 'Design & Build', 'Workplace Delivery Lead', 'RE Programme Lead', 'Fit-out Vendors', 'IT Team', 1, 'completed'),
    (t_id, p_id, 'IT Infrastructure', 'IT Infrastructure Lead', 'Technology Sponsor', 'Security', 'Facilities', 2, 'in_progress'),
    (t_id, p_id, 'Facilities Management', 'Facilities Lead', 'RE Programme Lead', 'RE Lead', 'Client Stakeholders', 3, 'in_progress'),
    (t_id, p_id, 'Change & Communications', 'Change Lead', 'HR Sponsor', 'HR Business Partners', 'All Staff', 4, 'assigned');
end $$;
