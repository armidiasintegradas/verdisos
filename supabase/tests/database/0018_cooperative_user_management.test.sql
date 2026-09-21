begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select has_function(
  'public'::name,
  'assign_cooperative_membership_m1'::name,
  array['uuid','uuid','uuid','text'],
  'cooperative membership assignment command exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.assign_cooperative_membership_m1(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'anonymous role cannot assign memberships'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '51000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','team-manager@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','team-operator@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','team-outsider@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  );

insert into public.tenants (id, slug, name) values
  ('52000000-0000-0000-0000-000000000001','team-m1','Team M1');

insert into public.organizations (id, tenant_id, legal_name, display_name) values
  (
    '53000000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    'Cooperativa Team M1',
    'Cooperativa Team M1'
  );

insert into public.units (id, tenant_id, organization_id, name, code) values
  (
    '54000000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000001',
    'Galpão Principal',
    'GALPAO-01'
  );

insert into public.memberships (
  tenant_id, organization_id, unit_id, user_id, role_id, status
)
select
  '52000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  r.id,
  'active'
from public.roles r
where r.code = 'cooperative_manager';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$ select public.assign_cooperative_membership_m1(
    '51000000-0000-0000-0000-000000000002',
    '53000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000001',
    'operator'
  ) $$,
  'cooperative manager can assign an operator'
);

reset role;

select is(
  (
    select count(*)::int
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = '51000000-0000-0000-0000-000000000002'
      and m.organization_id = '53000000-0000-0000-0000-000000000001'
      and m.unit_id = '54000000-0000-0000-0000-000000000001'
      and r.code = 'operator'
      and m.status = 'active'
  ),
  1,
  'assigned user receives the requested allowed role'
);

select is(
  (
    select count(*)::int
    from public.audit_events
    where organization_id = '53000000-0000-0000-0000-000000000001'
      and action = 'membership.assigned'
  ),
  1,
  'explicit membership assignment audit event is recorded'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$ select public.assign_cooperative_membership_m1(
    '51000000-0000-0000-0000-000000000002',
    '53000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000001',
    'operator'
  ) $$,
  'user already has an active membership in this scope',
  'duplicate active membership is blocked'
);

select throws_ok(
  $$ select public.assign_cooperative_membership_m1(
    '51000000-0000-0000-0000-000000000003',
    '53000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000001',
    'platform_admin'
  ) $$,
  'role is not allowed for cooperative membership',
  'privilege escalation to platform admin is blocked'
);

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000003',
  true
);

select throws_ok(
  $$ select public.assign_cooperative_membership_m1(
    '51000000-0000-0000-0000-000000000003',
    '53000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000001',
    'operator'
  ) $$,
  'membership assignment is not authorized',
  'user outside the managed scope cannot assign memberships'
);

reset role;

select is(
  (
    select count(*)::int
    from public.memberships
    where user_id = '51000000-0000-0000-0000-000000000003'
  ),
  0,
  'unauthorized assignment creates no membership'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.assign_cooperative_membership_m1(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated role may call the controlled command'
);

select is(
  (
    select count(*)::int
    from public.memberships
    where user_id = '51000000-0000-0000-0000-000000000002'
      and tenant_id = '52000000-0000-0000-0000-000000000001'
      and organization_id = '53000000-0000-0000-0000-000000000001'
  ),
  1,
  'assigned membership stays inside the cooperative tenant and organization'
);

select is(
  (
    select count(*)::int
    from public.audit_events
    where action = 'membership.changed'
      and organization_id = '53000000-0000-0000-0000-000000000001'
  ),
  2,
  'membership trigger audits manager seed and assigned operator'
);

select ok(
  exists(
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'assign_cooperative_membership_m1'
      and prosecdef
  ),
  'membership command is security definer with explicit authorization'
);

select * from finish();
rollback;
