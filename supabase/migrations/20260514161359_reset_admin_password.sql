-- Reset admin password to a known value
UPDATE auth.users 
SET 
  encrypted_password = crypt('Admin@Nautium2024', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'admin@nautium.app';