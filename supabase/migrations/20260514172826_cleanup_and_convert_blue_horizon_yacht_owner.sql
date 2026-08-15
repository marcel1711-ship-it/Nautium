
/*
  # Cleanup demo data and convert Blue Horizon to yacht_owner

  1. Delete 4 empty/duplicate companies (cascade removes all their data)
  2. Delete S/Y Artemis (Blue Horizon's second vessel, cascade removes equipment/tasks)
  3. Convert Blue Horizon Charter Co. to yacht_owner type (James Harrington, M/Y Neptune)
  4. Enrich M/Y Neptune with 4 additional equipment items and 4 maintenance tasks
*/

-- Step 1: Delete empty/duplicate companies
DELETE FROM companies WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000003'
);

-- Step 2: Delete S/Y Artemis (cascade removes its equipment and tasks)
DELETE FROM vessels WHERE id = '20000007-0000-0000-0000-000000000000';

-- Step 3: Convert Blue Horizon to yacht_owner
UPDATE companies SET
  customer_type = 'yacht_owner',
  yacht_name = 'M/Y Neptune',
  vessel_limit = 1,
  name = 'James Harrington',
  contact_name = 'James Harrington',
  subscription_status = 'active',
  notes = 'Private motor yacht owner based in Monaco. Seasonal cruising in the Med.'
WHERE id = '10000030-0000-0000-0000-000000000000';

-- Step 4: Update M/Y Neptune with richer details
UPDATE vessels SET
  name = 'M/Y Neptune',
  flag = 'GBR',
  year_built = 2018,
  length_overall = 28.5,
  gross_tonnage = 145
WHERE id = '20000006-0000-0000-0000-000000000000';

-- Step 5: Add 4 more equipment to M/Y Neptune
INSERT INTO equipment (id, company_id, vessel_id, name, type, manufacturer, model, serial_number, description, location, installation_date)
VALUES
  ('30000023-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   'Navigation Radar', 'navigation', 'Furuno', 'FAR-1518 Mark-3', 'FRN-8821004',
   'X-band radar, 12kW output. Annual service completed.', 'Wheelhouse', '2018-06-01'),
  ('30000024-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   'Hydraulic Bow Thruster', 'hull', 'Side-Power', 'SE250/300T', 'SP-2024-0093',
   'Tunnel thruster 250kgf. Hydraulic pump replaced 2024.', 'Bow', '2018-06-01'),
  ('30000025-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   'Air Conditioning System', 'hvac', 'MarineAir', 'MCM16K-410', 'MA-16K-00341',
   'Central chilled water HVAC, 5 zones. Refrigerant R-410A.', 'Engine Room', '2018-06-01'),
  ('30000026-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   'Watermaker', 'mechanical', 'Spectra', 'Newport 1000', 'SP-NP1000-5521',
   'Reverse osmosis, 1000 l/day output. Membranes last changed 2023.', 'Engine Room', '2018-06-01');

-- Step 6: Add maintenance tasks for new equipment (valid statuses: upcoming, due_soon, overdue, completed)
INSERT INTO maintenance_tasks (id, company_id, vessel_id, equipment_id, title, description, category, priority, frequency, next_due_date, status)
VALUES
  ('40000030-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   '30000023-0000-0000-0000-000000000000',
   'Radar Annual Calibration', 'Annual calibration and performance check. Verify range accuracy and bearing alignment.',
   'navigation', 'medium', 'annual', '2026-06-15', 'upcoming'),
  ('40000031-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   '30000024-0000-0000-0000-000000000000',
   'Bow Thruster Annual Service', 'Inspect tunnel, clean zinc anodes, check hydraulic fluid levels and all seals.',
   'hull', 'high', 'annual', '2026-07-01', 'upcoming'),
  ('40000032-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   '30000025-0000-0000-0000-000000000000',
   'A/C Pre-Season Inspection', 'Full inspection of chilled water circuit, clean all filters, check refrigerant pressure.',
   'hvac', 'medium', 'annual', '2026-05-20', 'due_soon'),
  ('40000033-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '20000006-0000-0000-0000-000000000000',
   '30000026-0000-0000-0000-000000000000',
   'Watermaker Membrane Flush', 'Pickling flush and pre-filter inspection before summer season start.',
   'mechanical', 'low', 'annual', '2026-04-10', 'completed');
