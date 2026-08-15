/*
  # Reset demo user passwords to 'demo123'

  Updates encrypted_password for all demo company users so they can
  sign in with password 'demo123' as expected by the app's demo flow.
*/

UPDATE auth.users
SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email IN (
  'marco@ninemoon.com',
  'captain@ninemoon.com',
  'sophie@rivierafleet.com',
  'engineer@rivierafleet.com',
  'james@bluehorizon.io'
);
