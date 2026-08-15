/*
  # Reset admin@nautium.app password

  Sets the password for admin@nautium.app to "millonario@2030"
*/

UPDATE auth.users
SET encrypted_password = crypt('millonario@2030', gen_salt('bf'))
WHERE email = 'admin@nautium.app';