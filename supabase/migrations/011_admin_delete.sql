-- Platform admins can delete projects from their own login.
-- Tenant delete is already covered by tenants_write_admin (for all).

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin" on public.projects
  for delete
  using (public.is_platform_admin());
