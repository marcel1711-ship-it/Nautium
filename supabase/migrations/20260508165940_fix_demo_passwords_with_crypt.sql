/*
  # Fix demo user passwords using pgcrypto crypt

  Uses PostgreSQL's crypt() function to generate a proper bcrypt hash
  for 'demo123' and applies it to all demo users so signInWithPassword works.
*/

UPDATE auth.users
SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  updated_at = now()
WHERE email IN (
  'captain@oceanicluxury.com',
  'chief.engineer@oceanicluxury.com',
  'engineer2@oceanicluxury.com',
  'operations@medfleet.com',
  'engineer@atlanticmarine.com',
  'admin@yachtmaintenance.pro'
);
