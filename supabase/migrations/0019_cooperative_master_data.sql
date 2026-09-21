-- VERDIS M1 — controlled master-data commands for cooperative operation.

create or replace function public.create_material_m1(
  p_organization_id uuid,
  p_code text,
  p_name text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_material_id uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
begin
  if v_user_id is null then raise exception 'authenticated user is required'; end if;

  select tenant_id into v_tenant_id
  from public.organizations
  where id = p_organization_id;

  if v_tenant_id is null then raise exception 'organization not found'; end if;

  if not app_private.has_permission(
    v_user_id, v_tenant_id, p_organization_id, null, 'scope.manage'
  ) then
    raise exception 'material creation is not authorized';
  end if;

  if v_code = '' or v_name = '' or v_category = '' then
    raise exception 'material code, name and category are required';
  end if;

  insert into public.materials (tenant_id, code, name, category, default_unit, active)
  values (v_tenant_id, v_code, v_name, v_category, 'kg', true)
  returning id into v_material_id;

  insert into public.audit_events (
    tenant_id, organization_id, actor_user_id, action, subject_type, subject_id, new_state
  ) values (
    v_tenant_id, p_organization_id, v_user_id,
    'material.created', 'material', v_material_id,
    jsonb_build_object('code', v_code, 'name', v_name, 'category', v_category)
  );

  return v_material_id;
end;
$$;

create or replace function public.create_counterparty_m1(
  p_organization_id uuid,
  p_external_name text,
  p_external_tax_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_counterparty_id uuid;
  v_name text := btrim(coalesce(p_external_name, ''));
  v_tax_id text := nullif(regexp_replace(coalesce(p_external_tax_id, ''), '[^0-9A-Za-z]', '', 'g'), '');
begin
  if v_user_id is null then raise exception 'authenticated user is required'; end if;

  select tenant_id into v_tenant_id
  from public.organizations
  where id = p_organization_id;

  if v_tenant_id is null then raise exception 'organization not found'; end if;

  if not app_private.has_permission(
    v_user_id, v_tenant_id, p_organization_id, null, 'scope.manage'
  ) then
    raise exception 'counterparty creation is not authorized';
  end if;

  if v_name = '' then raise exception 'counterparty name is required'; end if;

  if v_tax_id is not null and exists (
    select 1
    from public.counterparties c
    where c.tenant_id = v_tenant_id
      and c.organization_id = p_organization_id
      and c.external_tax_id = v_tax_id
  ) then
    raise exception 'counterparty tax id is already registered';
  end if;

  insert into public.counterparties (
    tenant_id, organization_id, external_name, external_tax_id
  ) values (
    v_tenant_id, p_organization_id, v_name, v_tax_id
  )
  returning id into v_counterparty_id;

  insert into public.audit_events (
    tenant_id, organization_id, actor_user_id, action, subject_type, subject_id, new_state
  ) values (
    v_tenant_id, p_organization_id, v_user_id,
    'counterparty.created', 'counterparty', v_counterparty_id,
    jsonb_build_object('external_name', v_name, 'external_tax_id', v_tax_id)
  );

  return v_counterparty_id;
end;
$$;

revoke all on function public.create_material_m1(uuid,text,text,text) from public, anon;
revoke all on function public.create_counterparty_m1(uuid,text,text) from public, anon;

grant execute on function public.create_material_m1(uuid,text,text,text) to authenticated;
grant execute on function public.create_counterparty_m1(uuid,text,text) to authenticated;

comment on function public.create_material_m1(uuid,text,text,text)
is 'Creates tenant-scoped material master data for an organization manager.';
comment on function public.create_counterparty_m1(uuid,text,text)
is 'Creates an external counterparty for an organization manager.';
