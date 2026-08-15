
/*
  # Create demo users for the 3 active demo companies

  Creates auth.users entries with password 'demo123' for:
  - NineMoon Yachting: marco@ninemoon.com (admin) + captain@ninemoon.com (standard)
  - Riviera Fleet Management: sophie@rivierafleet.com (admin) + engineer@rivierafleet.com (standard)
  - James Harrington: james@bluehorizon.io (admin)
*/

-- NineMoon Yachting: admin user (Marco Bellini)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  is_sso_user, is_anonymous
)
VALUES (
  '10000010-0000-0000-0009-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'marco@ninemoon.com',
  crypt('demo123', gen_salt('bf', 10)),
  now(),
  jsonb_build_object(
    'full_name', 'Marco Bellini',
    'role', 'customer_admin',
    'company_id', '10000010-0000-0000-0000-000000000000',
    'vessel_ids', jsonb_build_array(
      '20000001-0000-0000-0000-000000000000',
      '20000002-0000-0000-0000-000000000000',
      '20000003-0000-0000-0000-000000000000'
    )
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(), now(),
  false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- NineMoon Yachting: standard user (captain)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  is_sso_user, is_anonymous
)
VALUES (
  '10000010-0000-0000-0009-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'captain@ninemoon.com',
  crypt('demo123', gen_salt('bf', 10)),
  now(),
  jsonb_build_object(
    'full_name', 'Luca Ferrari',
    'role', 'standard_user',
    'company_id', '10000010-0000-0000-0000-000000000000',
    'vessel_ids', jsonb_build_array('20000001-0000-0000-0000-000000000000')
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(), now(),
  false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- Riviera Fleet Management: admin user (Sophie Laurent)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  is_sso_user, is_anonymous
)
VALUES (
  '10000020-0000-0000-0009-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'sophie@rivierafleet.com',
  crypt('demo123', gen_salt('bf', 10)),
  now(),
  jsonb_build_object(
    'full_name', 'Sophie Laurent',
    'role', 'customer_admin',
    'company_id', '10000020-0000-0000-0000-000000000000',
    'vessel_ids', jsonb_build_array(
      '20000004-0000-0000-0000-000000000000',
      '20000005-0000-0000-0000-000000000000'
    )
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(), now(),
  false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- Riviera Fleet Management: standard user (engineer)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  is_sso_user, is_anonymous
)
VALUES (
  '10000020-0000-0000-0009-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'engineer@rivierafleet.com',
  crypt('demo123', gen_salt('bf', 10)),
  now(),
  jsonb_build_object(
    'full_name', 'Pierre Dupont',
    'role', 'standard_user',
    'company_id', '10000020-0000-0000-0000-000000000000',
    'vessel_ids', jsonb_build_array('20000004-0000-0000-0000-000000000000')
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(), now(),
  false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- James Harrington (yacht_owner): single admin user
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  is_sso_user, is_anonymous
)
VALUES (
  '10000030-0000-0000-0009-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'james@bluehorizon.io',
  crypt('demo123', gen_salt('bf', 10)),
  now(),
  jsonb_build_object(
    'full_name', 'James Harrington',
    'role', 'customer_admin',
    'company_id', '10000030-0000-0000-0000-000000000000',
    'vessel_ids', jsonb_build_array('20000006-0000-0000-0000-000000000000')
  ),
  '{"provider":"email","providers":["email"]}'::jsonb,
  now(), now(),
  false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();
