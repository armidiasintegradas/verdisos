begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

select has_function(
  'public'::name,
  'bootstrap_cooperative_account'::name,
  array['text','text','text','text','text','text','text','text'],
  'cooperative onboarding RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'bootstrap_cooperative_account'
      and prosecdef
  ),
  'bootstrap runs as a controlled security definer command'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.bootstrap_cooperative_account(text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous role cannot execute bootstrap'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.bootstrap_cooperative_account(text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated role can execute bootstrap'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '31000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','onboarding@verdis.local',
  now(),now(),now(),'{}'::jsonb,'{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select * from public.bootstrap_cooperative_account(
    'coop-recife',
    'Cooperativa Recife',
    'Cooperativa Recife de Reciclagem',
    'Cooperativa Recife',
    '12.345.678/0001-90',
    'Galpão Principal',
    'REC-01',
    'Maria Gestora'
  ) $$,
  'authenticated user without membership can bootstrap one cooperative scope'
);

reset role;

select is(
  (select count(*)::int from public.tenants where slug = 'coop-recife'),
  1,
  'bootstrap creates exactly one tenant'
);

select is(
  (select count(*)::int from public.organizations where display_name = 'Cooperativa Recife'),
  1,
  'bootstrap creates exactly one organization'
);

select is(
  (
    select count(*)::int
    from public.units u
    join public.organizations o on o.id = u.organization_id
    join public.tenants t on t.id = u.tenant_id
    where t.slug = 'coop-recife'
      and o.display_name = 'Cooperativa Recife'
      and u.code = 'REC-01'
  ),
  1,
  'unit belongs to the newly created organization and tenant'
);

select is(
  (
    select count(*)::int
    from public.memberships m
    join public.roles r on r.id = m.role_id
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = '31000000-0000-0000-0000-000000000001'
      and m.status = 'active'
      and r.code = 'cooperative_manager'
      and t.slug = 'coop-recife'
  ),
  1,
  'initial membership is cooperative_manager for the authenticated user'
);

select is(
  (
    select display_name
    from public.user_profiles
    where user_id = '31000000-0000-0000-0000-000000000001'
  ),
  'Maria Gestora',
  'bootstrap stores the caller profile display name'
);

select is(
  (
    select tax_id
    from public.organizations
    where display_name = 'Cooperativa Recife'
  ),
  '12345678000190',
  'bootstrap normalizes tax id'
);

select is(
  (
    select count(*)::int
    from public.audit_events ae
    join public.tenants t on t.id = ae.tenant_id
    where t.slug = 'coop-recife'
      and ae.action = 'cooperative.bootstrap.completed'
  ),
  1,
  'bootstrap emits an explicit audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select * from public.bootstrap_cooperative_account(
    'coop-recife-2',
    'Cooperativa Recife 2',
    'Cooperativa Recife 2',
    'Cooperativa Recife 2',
    null,
    'Unidade 02',
    'REC-02',
    'Maria Gestora'
  ) $$,
  'account already has an active scope',
  'repeat bootstrap is blocked once an active scope exists'
);

reset role;

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '31000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','onboarding-duplicate@verdis.local',
  now(),now(),now(),'{}'::jsonb,'{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select * from public.bootstrap_cooperative_account(
    'coop-recife',
    'Outra Cooperativa',
    'Outra Cooperativa',
    'Outra Cooperativa',
    null,
    'Unidade',
    'UND-01',
    'Outro Gestor'
  ) $$,
  'tenant slug is unavailable',
  'duplicate tenant slug is rejected'
);

reset role;

select is(
  (
    select count(*)::int
    from public.memberships
    where user_id = '31000000-0000-0000-0000-000000000002'
  ),
  0,
  'failed bootstrap leaves no partial membership'
);

select * from finish();
rollback;
