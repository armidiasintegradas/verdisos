begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select has_function(
  'public'::name,
  'create_material_m1'::name,
  array['uuid','text','text','text'],
  'material creation command exists'
);

select has_function(
  'public'::name,
  'create_counterparty_m1'::name,
  array['uuid','text','text'],
  'counterparty creation command exists'
);

select ok(
  not has_function_privilege('anon','public.create_material_m1(uuid,text,text,text)','EXECUTE'),
  'anonymous role cannot create materials'
);

select ok(
  not has_function_privilege('anon','public.create_counterparty_m1(uuid,text,text)','EXECUTE'),
  'anonymous role cannot create counterparties'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '41000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','master-data@verdis.local',
  now(),now(),now(),'{}'::jsonb,'{}'::jsonb
);

insert into public.tenants (id, slug, name) values
  ('42000000-0000-0000-0000-000000000001','master-data','Master Data');

insert into public.organizations (id,tenant_id,legal_name,display_name) values
  ('43000000-0000-0000-0000-000000000001',
   '42000000-0000-0000-0000-000000000001',
   'Cooperativa Master Data',
   'Cooperativa Master Data');

insert into public.units (id,tenant_id,organization_id,name,code) values
  ('44000000-0000-0000-0000-000000000001',
   '42000000-0000-0000-0000-000000000001',
   '43000000-0000-0000-0000-000000000001',
   'Galpão Principal',
   'GALPAO-01');

insert into public.memberships (
  tenant_id,organization_id,unit_id,user_id,role_id,status
)
select
  '42000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  r.id,
  'active'
from public.roles r where r.code='cooperative_manager';

set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);

select lives_ok(
  $$ select public.create_material_m1(
    '43000000-0000-0000-0000-000000000001',
    'pet',
    'PET',
    'Plástico'
  ) $$,
  'cooperative manager can create a material'
);

select lives_ok(
  $$ select public.create_counterparty_m1(
    '43000000-0000-0000-0000-000000000001',
    'Comprador Recife',
    '98.765.432/0001-10'
  ) $$,
  'cooperative manager can create a counterparty'
);

reset role;

select is(
  (select count(*)::int from public.materials where tenant_id='42000000-0000-0000-0000-000000000001' and code='PET'),
  1,
  'material is stored in the correct tenant'
);

select is(
  (select count(*)::int from public.counterparties where organization_id='43000000-0000-0000-0000-000000000001' and external_name='Comprador Recife'),
  1,
  'counterparty is stored in the correct organization'
);

select is(
  (select external_tax_id from public.counterparties where organization_id='43000000-0000-0000-0000-000000000001' and external_name='Comprador Recife'),
  '98765432000110',
  'counterparty tax id is normalized'
);

select is(
  (select count(*)::int from public.audit_events where tenant_id='42000000-0000-0000-0000-000000000001' and action='material.created'),
  1,
  'material creation is audited'
);

select is(
  (select count(*)::int from public.audit_events where tenant_id='42000000-0000-0000-0000-000000000001' and action='counterparty.created'),
  1,
  'counterparty creation is audited'
);

insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '41000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','unauthorized-master-data@verdis.local',
  now(),now(),now(),'{}'::jsonb,'{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',true);

select throws_ok(
  $$ select public.create_material_m1(
    '43000000-0000-0000-0000-000000000001',
    'AL',
    'Alumínio',
    'Metal'
  ) $$,
  'material creation is not authorized',
  'user outside the scope cannot create material'
);

reset role;

select is(
  (select count(*)::int from public.materials where tenant_id='42000000-0000-0000-0000-000000000001' and code='AL'),
  0,
  'unauthorized material was not created'
);

select * from finish();
rollback;
