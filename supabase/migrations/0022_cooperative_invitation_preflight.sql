-- VERDIS M1 — preflight authorization for cooperative invitations.
-- Prevents unauthorized callers from triggering admin invitation emails before
-- the membership assignment command performs its final authorization check.

create or replace function public.authorize_cooperative_invitation_m1(
  p_organization_id uuid,
  p_unit_id uuid,
  p_role_code text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_role_code text := lower(btrim(coalesce(p_role_code, '')));
  v_unit_org uuid;
  v_unit_tenant uuid;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user is required';
  end if;

  select o.tenant_id
    into v_tenant_id
    from public.organizations o
   where o.id = p_organization_id;

  if v_tenant_id is null then
    raise exception 'organization not found';
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

  if not exists (
    select 1
      from public.roles r
     where r.code = v_role_code
       and r.built_in = true
  ) then
    raise exception 'requested role is not configured';
  end if;

  if not app_private.has_permission(
    v_actor_user_id,
    v_tenant_id,
    p_organization_id,
    p_unit_id,
    'scope.manage'
  ) then
    raise exception 'cooperative invitation is not authorized';
  end if;

  return true;
end;
$$;

revoke all on function public.authorize_cooperative_invitation_m1(uuid,uuid,text)
from public, anon;

grant execute on function public.authorize_cooperative_invitation_m1(uuid,uuid,text)
to authenticated;

comment on function public.authorize_cooperative_invitation_m1(uuid,uuid,text)
is 'Preflights cooperative invitation scope and role authorization before an admin email is sent.';
