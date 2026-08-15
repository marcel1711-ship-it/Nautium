/*
  # Create missing demo auth users and data

  Creates auth.users entries for demo users that are missing:
  - engineer@atlanticmarine.com (comp-3 standard user)
  - admin@yachtmaintenance.pro (master_admin)

  Also ensures comp-3 (Atlantic Marine Operations) and vessel-5 exist.

  Password hash is bcrypt of 'demo123' cost 10.
*/

-- Ensure company 3 exists
INSERT INTO companies (id, name, contact_name, contact_email, contact_phone, subscription_status, subscription_renewal_date, notes)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Atlantic Marine Operations',
  'James Peterson',
  'james@atlanticmarine.com',
  '+1-954-555-0789',
  'trial',
  '2026-08-30',
  'Trial period - potential conversion'
)
ON CONFLICT (id) DO NOTHING;

-- Ensure vessel 5 exists
INSERT INTO vessels (id, company_id, name, type, registration_id, description, location, notes, photo_url)
VALUES (
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0000-000000000003',
  'Atlantic Explorer',
  'Expedition Yacht',
  'EY-2017-AEX',
  '78m expedition yacht',
  'Miami',
  'Ice-class vessel',
  'https://images.pexels.com/photos/3046637/pexels-photo-3046637.jpeg?auto=compress&cs=tinysrgb&w=800'
)
ON CONFLICT (id) DO NOTHING;

-- Create engineer@atlanticmarine.com auth user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0009-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'engineer@atlanticmarine.com',
  '$2a$10$PviziUpMfXsqnfMxMBsJXunRQPUIzK3sWf8vbMTqSTZlhYBuXLzni',
  now(),
  now(),
  now(),
  '{"role": "standard_user", "full_name": "David Chen", "company_id": "00000000-0000-0000-0000-000000000003", "vessel_ids": ["00000000-0000-0000-0001-000000000005"]}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = '$2a$10$PviziUpMfXsqnfMxMBsJXunRQPUIzK3sWf8vbMTqSTZlhYBuXLzni',
  updated_at = now();

-- Create admin@yachtmaintenance.pro auth user (master_admin)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0009-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@yachtmaintenance.pro',
  '$2a$10$PviziUpMfXsqnfMxMBsJXunRQPUIzK3sWf8vbMTqSTZlhYBuXLzni',
  now(),
  now(),
  now(),
  '{"role": "master_admin", "full_name": "Platform Administrator"}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = '$2a$10$PviziUpMfXsqnfMxMBsJXunRQPUIzK3sWf8vbMTqSTZlhYBuXLzni',
  updated_at = now();
