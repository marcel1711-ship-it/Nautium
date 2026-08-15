
/*
  # Add auth.identities for demo users

  Supabase requires a row in auth.identities for each user to allow
  email/password sign-in. These were missing, causing "invalid login credentials".
*/

INSERT INTO auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at,
  created_at, updated_at
)
VALUES
  (
    '10000010-0000-0000-0009-000000000001',
    '10000010-0000-0000-0009-000000000001',
    'marco@ninemoon.com', 'email',
    jsonb_build_object('sub', '10000010-0000-0000-0009-000000000001', 'email', 'marco@ninemoon.com', 'email_verified', true),
    now(), now(), now()
  ),
  (
    '10000010-0000-0000-0009-000000000002',
    '10000010-0000-0000-0009-000000000002',
    'captain@ninemoon.com', 'email',
    jsonb_build_object('sub', '10000010-0000-0000-0009-000000000002', 'email', 'captain@ninemoon.com', 'email_verified', true),
    now(), now(), now()
  ),
  (
    '10000020-0000-0000-0009-000000000001',
    '10000020-0000-0000-0009-000000000001',
    'sophie@rivierafleet.com', 'email',
    jsonb_build_object('sub', '10000020-0000-0000-0009-000000000001', 'email', 'sophie@rivierafleet.com', 'email_verified', true),
    now(), now(), now()
  ),
  (
    '10000020-0000-0000-0009-000000000002',
    '10000020-0000-0000-0009-000000000002',
    'engineer@rivierafleet.com', 'email',
    jsonb_build_object('sub', '10000020-0000-0000-0009-000000000002', 'email', 'engineer@rivierafleet.com', 'email_verified', true),
    now(), now(), now()
  ),
  (
    '10000030-0000-0000-0009-000000000001',
    '10000030-0000-0000-0009-000000000001',
    'james@bluehorizon.io', 'email',
    jsonb_build_object('sub', '10000030-0000-0000-0009-000000000001', 'email', 'james@bluehorizon.io', 'email_verified', true),
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;
