begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_function(
  'public'::name,
  'list_cooperative_team_m1'::name,
  array['uuid','uuid'],
  'cooperative team listing command exists'
);

select has_function(
  'public'::name,
  'set_cooperative_membership_status_m1'::name,
  array['uuid','text'],
  'cooperative membership lifecycle command exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_cooperative_team_m1(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous role cannot list cooperative team'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_cooperative_membership_status_m1(uuid,text)',
    'EXECUTE'
  ),
  'anonymous role cannot change membership lifecycle'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '61000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','team-admin@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','team-member@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  );

insert into public.user_profiles (user_id, display_name) values
  ('61000000-0000-0000-0000-000000000001','Gestora Team'),
  ('61000000-0000-0000-0000-000000000002','Operador Team');

insert into public.tenants (id, slug, name) values
  ('62000000-0000-0000-0000-000000000001','team-lifecycle','Team Lifecycle');

insert into public.organizations (id, tenant_id, legal_name, display_name) values
  (
    '63000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    'Cooperativa Team Lifecycle',
    'Cooperativa Team Lifecycle'
  );

insert into public.units (id, tenant_id, organization_id, name, code) values
  (
    '64000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    'Galpão',
    'GALPAO'
  );

insert into public.memberships (
  id, tenant_id, organization_id, unit_id, user_id, role_id, status
)
select
  '65000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  r.id,
  'active'
from public.roles r
where r.code = 'cooperative_manager';

insert into public.memberships (
  id, tenant_id, organization_id, unit_id, user_id, role_id, status
)
select
  '65000000-0000-0000-0000-000000000002',
  '62000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000002',
  r.id,
  'active'
from public.roles r
where r.code = 'operator';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);

select is(
  (
    select count(*)::int
    from public.list_cooperative_team_m1(
      '63000000-0000-0000-0000-000000000001',
      '64000000-0000-0000-0000-000000000001'
    )
  ),
  2,
  'manager can list team inside managed cooperative scope'
);

select lives_ok(
  $$ select public.set_cooperative_membership_status_m1(
    '65000000-0000-0000-0000-000000000002',
    'suspended'
  ) $$,
  'manager can suspend another membership'
);

reset role;

select is(
  (
    select status::text
    from public.memberships
    where id = '65000000-0000-0000-0000-000000000002'
  ),
  'suspended',
  'target membership is suspended'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$ select * from public.list_cooperative_team_m1(
    '63000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000001'
  ) $$,
  'team listing is not authorized',
  'operator cannot list cooperative team'
);

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '61000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$ select public.set_cooperative_membership_status_m1(
    '65000000-0000-0000-0000-000000000001',
    'suspended'
  ) $$,
  'cannot change your own membership status',
  'manager cannot lock out own membership'
);

select lives_ok(
  $$ select public.set_cooperative_membership_status_m1(
    '65000000-0000-0000-0000-000000000002',
    'active'
  ) $$,
  'manager can reactivate another membership'
);

reset role;

select is(
  (
    select status::text
    from public.memberships
    where id = '65000000-0000-0000-0000-000000000002'
  ),
  'active',
  'target membership is active again'
);

select is(
  (
    select count(*)::int
    from public.audit_events
    where organization_id = '63000000-0000-0000-0000-000000000001'
      and action = 'membership.changed'
  ),
  4,
  'membership insert and lifecycle changes remain audited'
);

select * from finish();
rollback;
