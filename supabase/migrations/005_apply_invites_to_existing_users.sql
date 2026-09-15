-- Fix: an invite created AFTER a user signed up was never applied.
--
-- 003's ensure_profile() returned early whenever a profile already existed, so
-- a user who signed up first (landing on client_viewer with tenant_id = NULL)
-- stayed unattached forever, no matter how many times they signed out and in.
--
-- This version also claims a pending invite for an existing profile, and adds
-- an admin function so staff can attach a user without waiting for re-login.

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

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into uemail, umeta
  from auth.users u
  where u.id = uid;

  -- At most one pending invite per email (invites_email_pending_idx).
  select * into invite_row
  from public.invites
  where accepted_at is null
    and lower(email) = lower(uemail)
  limit 1;

  select p.* into out_row from public.profiles p where p.id = uid;

  if found then
    -- Never let an invite demote the platform admin out of their own console.
    if invite_row.id is not null and out_row.role <> 'platform_admin' then
      update public.profiles
         set tenant_id = invite_row.tenant_id,
             role      = invite_row.role
       where id = uid
      returning * into out_row;

      update public.invites
         set accepted_at = now()
       where id = invite_row.id;

      return jsonb_build_object(
        'created',        false,
        'invite_applied', true,
        'id',             out_row.id,
        'role',           out_row.role,
        'tenant_id',      out_row.tenant_id
      );
    end if;

    return jsonb_build_object(
      'created',        false,
      'invite_applied', false,
      'id',             out_row.id,
      'role',           out_row.role,
      'tenant_id',      out_row.tenant_id
    );
  end if;

  select count(*) into admin_count
  from public.profiles
  where role = 'platform_admin';

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
    'created',        true,
    'invite_applied', invite_row.id is not null,
    'id',             out_row.id,
    'role',           out_row.role,
    'tenant_id',      out_row.tenant_id
  );
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- Attach a user to a client immediately, by email.
--
-- If they have already signed up, their profile is updated in place (no
-- re-login needed). If they have not, a pending invite is recorded so signup
-- picks it up. RLS on profiles only allows self-update, so this has to be
-- security definer, and it checks platform_admin itself.
create or replace function public.admin_assign_profile(
  target_email  text,
  target_tenant uuid,
  target_role   public.app_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(target_email));
  out_row    public.profiles;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_assign_profile: only the platform admin can assign users';
  end if;

  if normalized = '' or normalized is null then
    raise exception 'admin_assign_profile: email is required';
  end if;

  if target_role::text like 'client%' and target_tenant is null then
    raise exception 'admin_assign_profile: client roles need a client company';
  end if;

  update public.profiles
     set tenant_id = target_tenant,
         role      = target_role
   where lower(email) = normalized
  returning * into out_row;

  if found then
    update public.invites
       set accepted_at = now()
     where accepted_at is null
       and lower(email) = normalized;

    return jsonb_build_object(
      'outcome',   'profile_updated',
      'id',        out_row.id,
      'role',      out_row.role,
      'tenant_id', out_row.tenant_id
    );
  end if;

  delete from public.invites
   where accepted_at is null
     and lower(email) = normalized;

  insert into public.invites (email, role, tenant_id, invited_by)
  values (normalized, target_role, target_tenant, auth.uid());

  return jsonb_build_object('outcome', 'invite_created');
end;
$$;

grant execute on function public.admin_assign_profile(text, uuid, public.app_role)
  to authenticated;
