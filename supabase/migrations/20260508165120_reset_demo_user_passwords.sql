/*
  # Reset demo user passwords to demo123

  Sets the bcrypt-hashed password for all demo users so that
  signInWithPassword('demo123') succeeds and a valid Supabase
  auth session is established, allowing RLS policies to pass.

  The hash below is bcrypt of 'demo123' with cost factor 10.
*/

UPDATE auth.users
SET
  encrypted_password = '$2a$10$PviziUpMfXsqnfMxMBsJXunRQPUIzK3sWf8vbMTqSTZlhYBuXLzni',
  updated_at = now()
WHERE email IN (
  'captain@oceanicluxury.com',
  'chief.engineer@oceanicluxury.com',
  'engineer2@oceanicluxury.com',
  'operations@medfleet.com',
  'engineer@atlanticmarine.com'
);
