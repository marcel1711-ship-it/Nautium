/*
  # Seed Demo Companies and Vessels

  Inserts the two demo companies (Oceanic Luxury Yachts and Mediterranean Fleet Services)
  and their vessels into Supabase as real records using fixed UUIDs so they match
  the existing demoData.ts references after migration.

  1. Companies: 2 demo companies with active subscriptions
  2. Vessels: 4 vessels belonging to those companies
*/

-- Insert demo companies with fixed UUIDs
INSERT INTO companies (id, name, contact_name, contact_email, contact_phone, subscription_status, subscription_renewal_date, notes, customer_type, vessel_limit, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Oceanic Luxury Yachts', 'Richard Morgan', 'richard.morgan@oceanicluxury.com', '+1-305-555-0123', 'active', '2027-03-15', 'Premium client with 3 mega yachts', 'agency', 5, '2025-01-15T10:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'Mediterranean Fleet Services', 'Sofia Rossi', 'sofia.rossi@medfleet.com', '+39-06-555-0456', 'active', '2026-12-01', 'Charter fleet operator', 'agency', 3, '2025-06-20T14:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- Insert demo vessels with fixed UUIDs
INSERT INTO vessels (id, company_id, name, type, registration_id, description, location, notes, photo_url, created_at)
VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Azure Dream', 'motor_yacht', 'MY-2018-ADR', '85m luxury motor yacht', 'Monaco', 'Flagship vessel - highest priority', 'https://images.pexels.com/photos/1118869/pexels-photo-1118869.jpeg?auto=compress&cs=tinysrgb&w=800', '2025-01-15T10:30:00Z'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Ocean Star', 'motor_yacht', 'MY-2020-OST', '72m luxury motor yacht', 'Fort Lauderdale', 'Recently refitted', 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=800', '2025-01-15T11:00:00Z'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Sea Serenity', 'sailing_yacht', 'SY-2019-SSR', '58m sailing yacht', 'Caribbean', 'Charter season active', 'https://images.pexels.com/photos/273886/pexels-photo-273886.jpeg?auto=compress&cs=tinysrgb&w=800', '2025-01-15T11:30:00Z'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000002', 'Mediterraneo', 'motor_yacht', 'MY-2021-MED', '65m motor yacht', 'Palma de Mallorca', 'Charter fleet', 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg?auto=compress&cs=tinysrgb&w=800', '2025-06-20T15:00:00Z')
ON CONFLICT (id) DO NOTHING;
