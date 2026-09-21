-- VERDIS M1 — cooperative team read model and membership lifecycle commands.

create or replace function public.list_cooperative_team_m1(
  p_organization_id uuid,
  p_unit_id uuid default null
)
returns table(
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  role_code text,
  role_name text,
  status public.membership_status,
  unit_id uuid
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_tenant_id uuid;
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

  if not app_private.has_permission(
    v_actor_user_id,
    v_tenant_id,
    p_organization_id,
    p_unit_id,
    'scope.manage'
  ) then
    raise exception 'team listing is not authorized';
  end if;

  return query
  select
    m.id,
    m.user_id,
    u.email::text,
    coalesce(up.display_name, split_part(u.email::text, '@', 1)),
    r.code,
    r.name,
    m.status,
    m.unit_id
  from public.memberships m
  join auth.users u on u.id = m.user_id
  join public.roles r on r.id = m.role_id
  left join public.user_profiles up on up.user_id = m.user_id
  where m.tenant_id = v_tenant_id
    and m.organization_id = p_organization_id
    and (p_unit_id is null or m.unit_id is null or m.unit_id = p_unit_id)
  order by
    case m.status when 'active' then 0 when 'invited' then 1 when 'suspended' then 2 else 3 end,
    coalesce(up.display_name, u.email::text);
end;
$$;

create or replace function public.set_cooperative_membership_status_m1(
  p_membership_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_status public.membership_status;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user is required';
  end if;

  if p_status not in ('active','suspended','ended') then
    raise exception 'invalid membership status';
  end if;

  v_status := p_status::public.membership_status;

  select *
    into v_membership
    from public.memberships
   where id = p_membership_id
   for update;

  if v_membership.id is null then
    raise exception 'membership not found';
  end if;

  if not app_private.has_permission(
    v_actor_user_id,
    v_membership.tenant_id,
    v_membership.organization_id,
    v_membership.unit_id,
    'scope.manage'
  ) then
    raise exception 'membership status change is not authorized';
  end if;

  if v_membership.user_id = v_actor_user_id then
    raise exception 'cannot change your own membership status';
  end if;

  if v_membership.status = v_status then
    return;
  end if;

  update public.memberships
     set status = v_status,
         ends_at = case
           when v_status = 'ended' then now()
           when v_status = 'active' then null
           else ends_at
         end
   where id = p_membership_id;
end;
$$;

revoke all on function public.list_cooperative_team_m1(uuid,uuid) from public, anon;
revoke all on function public.set_cooperative_membership_status_m1(uuid,text) from public, anon;

grant execute on function public.list_cooperative_team_m1(uuid,uuid) to authenticated;
grant execute on function public.set_cooperative_membership_status_m1(uuid,text) to authenticated;

comment on function public.list_cooperative_team_m1(uuid,uuid)
is 'Returns cooperative team members only to users with scope.manage in the requested scope.';
comment on function public.set_cooperative_membership_status_m1(uuid,text)
is 'Changes another cooperative member status after scope.manage authorization; self-lockout is blocked.';
