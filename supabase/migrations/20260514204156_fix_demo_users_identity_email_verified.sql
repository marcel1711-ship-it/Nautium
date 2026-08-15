/*
  # Fix demo users auth.identities email_verified flag
  
  Sets email_verified=true in identity_data for all demo company users
  so Supabase auth allows sign-in without issues.
*/

UPDATE auth.identities
SET identity_data = identity_data || '{"email_verified": true}'::jsonb
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'james@bluehorizon.io',
    'marco@ninemoon.com',
    'sophie@rivierafleet.com',
    'captain@ninemoon.com',
    'engineer@rivierafleet.com'
  )
);
