-- VERDIS M1 — transactional bootstrap for the first cooperative account.
-- Converts an authenticated user without active memberships into a complete
-- tenant -> organization -> unit -> cooperative_manager scope atomically.

create or replace function public.bootstrap_cooperative_account(
  p_tenant_slug text,
  p_tenant_name text,
  p_organization_legal_name text,
  p_organization_display_name text,
  p_tax_id text default null,
  p_unit_name text default 'Unidade Principal',
  p_unit_code text default 'UNIDADE-01',
  p_display_name text default null
)
returns table(
  tenant_id uuid,
  organization_id uuid,
  unit_id uuid,
  membership_id uuid,
  role_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_organization_id uuid;
  v_unit_id uuid;
  v_membership_id uuid;
  v_role_id uuid;
  v_slug text := lower(btrim(coalesce(p_tenant_slug, '')));
  v_tenant_name text := btrim(coalesce(p_tenant_name, ''));
  v_legal_name text := btrim(coalesce(p_organization_legal_name, ''));
  v_display_name text := btrim(coalesce(p_organization_display_name, ''));
  v_tax_id text := nullif(regexp_replace(coalesce(p_tax_id, ''), '[^0-9A-Za-z]', '', 'g'), '');
  v_unit_name text := btrim(coalesce(p_unit_name, ''));
  v_unit_code text := upper(btrim(coalesce(p_unit_code, '')));
  v_profile_name text := nullif(btrim(coalesce(p_display_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'authenticated user is required';
  end if;

  -- Serialize bootstrap attempts for the same auth user.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1
    from public.memberships m
    where m.user_id = v_user_id
      and m.status = 'active'
      and m.starts_at <= now()
      and (m.ends_at is null or m.ends_at > now())
  ) then
    raise exception 'account already has an active scope';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid tenant slug';
  end if;

  if v_tenant_name = '' or v_legal_name = '' or v_display_name = '' or v_unit_name = '' or v_unit_code = '' then
    raise exception 'tenant, organization and unit names are required';
  end if;

  if exists (select 1 from public.tenants t where t.slug = v_slug) then
    raise exception 'tenant slug is unavailable';
  end if;

  if v_tax_id is not null and exists (
    select 1 from public.organizations o where o.tax_id = v_tax_id
  ) then
    raise exception 'tax id is already registered';
  end if;

  select r.id
    into v_role_id
    from public.roles r
   where r.code = 'cooperative_manager'
     and r.built_in = true
   limit 1;

  if v_role_id is null then
    raise exception 'cooperative manager role is not configured';
  end if;

  insert into public.user_profiles (user_id, display_name)
  values (v_user_id, v_profile_name)
  on conflict (user_id) do update
    set display_name = coalesce(excluded.display_name, public.user_profiles.display_name);

  insert into public.tenants (slug, name)
  values (v_slug, v_tenant_name)
  returning id into v_tenant_id;

  insert into public.organizations (tenant_id, legal_name, display_name, tax_id)
  values (v_tenant_id, v_legal_name, v_display_name, v_tax_id)
  returning id into v_organization_id;

  insert into public.units (tenant_id, organization_id, name, code)
  values (v_tenant_id, v_organization_id, v_unit_name, v_unit_code)
  returning id into v_unit_id;

  insert into public.memberships (
    tenant_id, organization_id, unit_id, user_id, role_id, status
  ) values (
    v_tenant_id, v_organization_id, v_unit_id, v_user_id, v_role_id, 'active'
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
    v_organization_id,
    v_unit_id,
    v_user_id,
    'cooperative.bootstrap.completed',
    'organization',
    v_organization_id,
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'organization_id', v_organization_id,
      'unit_id', v_unit_id,
      'membership_id', v_membership_id,
      'role_id', v_role_id
    ),
    jsonb_build_object('source', 'm1_onboarding')
  );

  return query
  select v_tenant_id, v_organization_id, v_unit_id, v_membership_id, v_role_id;
end;
$$;

revoke all on function public.bootstrap_cooperative_account(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.bootstrap_cooperative_account(text,text,text,text,text,text,text,text) to authenticated;

comment on function public.bootstrap_cooperative_account(text,text,text,text,text,text,text,text)
is 'Atomically creates the first cooperative tenant, organization, unit and cooperative_manager membership for the authenticated user when no active membership exists.';
