begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

select has_function(
  'public'::name,
  'authorize_cooperative_invitation_m1'::name,
  array['uuid','uuid','text'],
  'cooperative invitation preflight exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.authorize_cooperative_invitation_m1(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anonymous role cannot preflight invitations'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '71000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','invite-manager@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','invite-outsider@verdis.local',
    now(),now(),now(),'{}'::jsonb,'{}'::jsonb
  );

insert into public.tenants (id, slug, name) values
  ('72000000-0000-0000-0000-000000000001','invite-preflight','Invite Preflight');

insert into public.organizations (id, tenant_id, legal_name, display_name) values
  (
    '73000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    'Cooperativa Invite Preflight',
    'Cooperativa Invite Preflight'
  );

insert into public.units (id, tenant_id, organization_id, name, code) values
  (
    '74000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'Galpão',
    'GALPAO'
  );

insert into public.memberships (
  tenant_id, organization_id, unit_id, user_id, role_id, status
)
select
  '72000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  r.id,
  'active'
from public.roles r
where r.code = 'cooperative_manager';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000001',
  true
);

select is(
  public.authorize_cooperative_invitation_m1(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'operator'
  ),
  true,
  'manager can preflight an allowed cooperative invitation'
);

select throws_ok(
  $$ select public.authorize_cooperative_invitation_m1(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'platform_admin'
  ) $$,
  'role is not allowed for cooperative membership',
  'preflight blocks privilege escalation'
);

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$ select public.authorize_cooperative_invitation_m1(
    '73000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'operator'
  ) $$,
  'cooperative invitation is not authorized',
  'outsider cannot trigger invitation email preflight'
);

reset role;

select * from finish();
rollback;
