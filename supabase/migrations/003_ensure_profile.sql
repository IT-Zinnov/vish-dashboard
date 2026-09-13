-- Idempotent profile bootstrap, callable by the signed-in user.
--
-- The 001 trigger only fires for NEW auth.users rows, so any account created
-- before the trigger existed (or while it errored) ends up with no profile and
-- therefore no role. This RPC repairs that on demand, and is safe to call on
-- every login: it returns the existing profile if one is already present.
--
-- Role assignment is decided INSIDE this function, never by the caller, so a
-- client cannot make itself platform_admin.

create or replace function public.ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  uemail       text;
  umeta        jsonb;
  admin_count  int;
  invite_row   public.invites%rowtype;
  new_role     public.app_role;
  new_tenant   uuid;
  out_row      public.profiles;
begin
  if uid is null then
    raise exception 'ensure_profile: no authenticated user';
  end if;

  select p.* into out_row from public.profiles p where p.id = uid;
  if found then
    return jsonb_build_object(
      'created',   false,
      'id',        out_row.id,
      'role',      out_row.role,
      'tenant_id', out_row.tenant_id
    );
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into uemail, umeta
  from auth.users u
  where u.id = uid;

  select count(*) into admin_count
  from public.profiles
  where role = 'platform_admin';

  select * into invite_row
  from public.invites
  where accepted_at is null
    and lower(email) = lower(uemail)
  order by created_at desc
  limit 1;

  if admin_count = 0 then
    new_role   := 'platform_admin';
    new_tenant := null;
  elsif invite_row.id is not null then
    new_role   := invite_row.role;
    new_tenant := invite_row.tenant_id;
  else
    new_role   := 'client_viewer';
    new_tenant := null;
  end if;

  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (
    uid,
    new_tenant,
    new_role,
    coalesce(nullif(umeta->>'full_name', ''), split_part(uemail, '@', 1)),
    uemail
  )
  returning * into out_row;

  if invite_row.id is not null then
    update public.invites set accepted_at = now() where id = invite_row.id;
  end if;

  return jsonb_build_object(
    'created',   true,
    'id',        out_row.id,
    'role',      out_row.role,
    'tenant_id', out_row.tenant_id
  );
end;
$$;

grant execute on function public.ensure_profile() to authenticated;
