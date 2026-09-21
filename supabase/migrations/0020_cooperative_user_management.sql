-- VERDIS M1 — controlled cooperative team membership assignment.
-- Auth user creation/invitation remains server-side in an Edge Function.
-- This RPC only binds an existing auth user to an authorized cooperative scope.

create or replace function public.assign_cooperative_membership_m1(
  p_user_id uuid,
  p_organization_id uuid,
  p_unit_id uuid,
  p_role_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role_id uuid;
  v_membership_id uuid;
  v_role_code text := lower(btrim(coalesce(p_role_code, '')));
  v_unit_org uuid;
  v_unit_tenant uuid;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user is required';
  end if;

  if p_user_id is null then
    raise exception 'target user is required';
  end if;

  select o.tenant_id
    into v_tenant_id
    from public.organizations o
   where o.id = p_organization_id;

  if v_tenant_id is null then
    raise exception 'organization not found';
  end if;

  if not app_private.has_permission(
    v_actor_user_id,
    v_tenant_id,
    p_organization_id,
    p_unit_id,
    'scope.manage'
  ) then
    raise exception 'membership assignment is not authorized';
  end if;

  if p_unit_id is not null then
    select u.organization_id, u.tenant_id
      into v_unit_org, v_unit_tenant
      from public.units u
     where u.id = p_unit_id;

    if v_unit_org is null
       or v_unit_org <> p_organization_id
       or v_unit_tenant <> v_tenant_id then
      raise exception 'membership unit must belong to organization';
    end if;
  end if;

  if v_role_code not in ('cooperative_manager','operator','finance','auditor') then
    raise exception 'role is not allowed for cooperative membership';
  end if;

  select r.id
    into v_role_id
    from public.roles r
   where r.code = v_role_code
     and r.built_in = true
   limit 1;

  if v_role_id is null then
    raise exception 'requested role is not configured';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'target auth user not found';
  end if;

  if exists (
    select 1
      from public.memberships m
     where m.user_id = p_user_id
       and m.tenant_id = v_tenant_id
       and m.organization_id = p_organization_id
       and m.unit_id is not distinct from p_unit_id
       and m.status = 'active'
       and m.starts_at <= now()
       and (m.ends_at is null or m.ends_at > now())
  ) then
    raise exception 'user already has an active membership in this scope';
  end if;

  insert into public.memberships (
    tenant_id,
    organization_id,
    unit_id,
    user_id,
    role_id,
    status
  ) values (
    v_tenant_id,
    p_organization_id,
    p_unit_id,
    p_user_id,
    v_role_id,
    'active'
  )
  returning id into v_membership_id;

  insert into public.audit_events (
    tenant_id,
    organization_id,
    unit_id,
    actor_user_id,
    action,
    subject_type,
    subject_id,
    new_state,
    technical_context
  ) values (
    v_tenant_id,
    p_organization_id,
    p_unit_id,
    v_actor_user_id,
    'membership.assigned',
    'membership',
    v_membership_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'role_code', v_role_code,
      'role_id', v_role_id
    ),
    jsonb_build_object('source', 'm1_team_management')
  );

  return v_membership_id;
end;
$$;

revoke all on function public.assign_cooperative_membership_m1(uuid,uuid,uuid,text)
from public, anon;

grant execute on function public.assign_cooperative_membership_m1(uuid,uuid,uuid,text)
to authenticated;

comment on function public.assign_cooperative_membership_m1(uuid,uuid,uuid,text)
is 'Assigns an existing auth user to an authorized cooperative organization/unit using an allowed built-in role.';
