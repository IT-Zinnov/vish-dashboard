-- Remove identities left behind by client deletions performed before the
-- lifecycle fix, and anonymize seeded demonstration case studies.
-- Run after 007_admin_lifecycle.sql.

delete from auth.users
where id in (
  select id
  from public.profiles
  where access_revoked_at is not null
    and role <> 'platform_admin'
);

update public.case_studies
set name = 'Fortune 500 E-commerce Company',
    summary = 'Anonymized multi-phase India GCC workplace delivery case study.',
    updated_at = now()
where slug = 'ebay';

update public.case_studies
set name = 'Global Media Intelligence Company',
    summary = 'Anonymized technology-office workplace delivery case study.',
    updated_at = now()
where slug = 'meltwater';

