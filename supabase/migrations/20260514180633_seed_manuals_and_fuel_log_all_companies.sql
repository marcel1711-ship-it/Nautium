
/*
  # Seed maintenance manuals and additional fuel log entries

  Adds manuals for all demo vessels and enriches fuel log entries for
  Riviera Fleet Management and M/Y Neptune (previously sparse).
*/

-- ============================================================
-- MAINTENANCE MANUALS
-- ============================================================
INSERT INTO maintenance_manuals (
  id, vessel_id, company_id, equipment_id,
  title, description, file_name, file_url, file_size,
  uploaded_by_id, uploaded_by_name, created_at
) VALUES

-- NineMoon – M/Y Luna Rossa
(
  '80000001-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  '30000001-0000-0000-0000-000000000000',
  'MTU Series 4000 Operation & Maintenance Manual',
  'Complete operation and maintenance manual for MTU 4000 series main engines',
  'MTU_4000_Series_OM_Manual.pdf', '#', 18874368,
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', (NOW() - INTERVAL '400 days')
),
(
  '80000002-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  '30000003-0000-0000-0000-000000000000',
  'Kohler Marine Generator Service Manual',
  'Service and troubleshooting guide for Kohler marine generator sets',
  'Kohler_Marine_Gen_Service.pdf', '#', 9437184,
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', (NOW() - INTERVAL '395 days')
),
(
  '80000003-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  '30000005-0000-0000-0000-000000000000',
  'Watermaker System User Manual',
  'Installation, operation and maintenance guide for the onboard reverse osmosis system',
  'Watermaker_User_Manual.pdf', '#', 5242880,
  '2abf1601-2068-4fc0-91fb-14716e0ed15d', 'Luca Ferrari', (NOW() - INTERVAL '380 days')
),

-- NineMoon – S/Y Tramontana
(
  '80000004-0000-0000-0000-000000000000',
  '20000002-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  '30000008-0000-0000-0000-000000000000',
  'CAT C32 ACERT Marine Engine Manual',
  'Complete workshop and operation manual for CAT C32 ACERT engine',
  'CAT_C32_ACERT_Workshop_Manual.pdf', '#', 22020096,
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', (NOW() - INTERVAL '350 days')
),
(
  '80000005-0000-0000-0000-000000000000',
  '20000002-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  NULL,
  'Standing Rigging Inspection & Replacement Guide',
  'Best practice guide for standing rigging inspection, maintenance and replacement intervals',
  'Rigging_Inspection_Guide.pdf', '#', 4194304,
  '2abf1601-2068-4fc0-91fb-14716e0ed15d', 'Luca Ferrari', (NOW() - INTERVAL '210 days')
),

-- NineMoon – M/Y Stella Maris
(
  '80000006-0000-0000-0000-000000000000',
  '20000003-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000',
  '30000010-0000-0000-0000-000000000000',
  'Volvo Penta IPS Drive Owner Manual',
  'Owner and operator manual for Volvo Penta IPS pod drive system',
  'Volvo_IPS_Owner_Manual.pdf', '#', 12582912,
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', (NOW() - INTERVAL '370 days')
),

-- Riviera Fleet – M/Y Cote Azur
(
  '80000007-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  '30000012-0000-0000-0000-000000000000',
  'Volvo Penta D13 Workshop Manual',
  'Complete workshop manual for Volvo Penta D13 engine series',
  'Volvo_D13_Workshop_Manual.pdf', '#', 19922944,
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', (NOW() - INTERVAL '420 days')
),
(
  '80000008-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  NULL,
  'MCA Coded Vessel Safety Manual',
  'Vessel safety procedures and emergency protocols as required by MCA coding',
  'MCA_Safety_Manual_CoteAzur.pdf', '#', 6291456,
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', (NOW() - INTERVAL '400 days')
),
(
  '80000009-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  '30000014-0000-0000-0000-000000000000',
  'Garmin GPSMAP 8000 Series Owner Manual',
  'Installation, configuration and operation manual for Garmin GPSMAP multifunction display',
  'Garmin_GPSMAP8000_Manual.pdf', '#', 8388608,
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont', (NOW() - INTERVAL '300 days')
),

-- Riviera Fleet – M/Y Belle Epoque
(
  '80000010-0000-0000-0000-000000000000',
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  '30000015-0000-0000-0000-000000000000',
  'Volvo Penta D13 Workshop Manual',
  'Complete workshop manual for Volvo Penta D13 engine series',
  'Volvo_D13_Workshop_Manual_v2.pdf', '#', 19922944,
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', (NOW() - INTERVAL '410 days')
),
(
  '80000011-0000-0000-0000-000000000000',
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  NULL,
  'Bilge Pump System Maintenance Guide',
  'Comprehensive guide to bilge pump inspection, testing and maintenance procedures',
  'Bilge_Pump_Maintenance.pdf', '#', 3145728,
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont', (NOW() - INTERVAL '180 days')
),

-- M/Y Neptune
(
  '80000012-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  '30000017-0000-0000-0000-000000000000',
  'Volvo Penta D6 Owner Manual',
  'Owner and service manual for Volvo Penta D6 diesel engine',
  'Volvo_D6_Owner_Manual.pdf', '#', 11534336,
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', (NOW() - INTERVAL '500 days')
),
(
  '80000013-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  '30000023-0000-0000-0000-000000000000',
  'Furuno FAR-2228 Radar Service Manual',
  'Technical service manual for Furuno FAR-2228 marine radar system',
  'Furuno_FAR2228_Service_Manual.pdf', '#', 14680064,
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', (NOW() - INTERVAL '480 days')
),
(
  '80000014-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  NULL,
  'MCA Small Commercial Vessel Safety Manual',
  'Safety procedures, emergency protocols and compliance documentation for MCA coded vessel',
  'MCA_Neptune_Safety_Manual.pdf', '#', 7340032,
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', (NOW() - INTERVAL '460 days')
)

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ADDITIONAL FUEL LOG ENTRIES
-- ============================================================
INSERT INTO fuel_log (
  id, resource_id, vessel_id, company_id,
  entry_type, quantity, price_per_unit, total_cost, currency,
  supplier, location, engine_hours, notes,
  logged_by_id, logged_by_name, log_date, created_at
) VALUES

-- Riviera Fleet – M/Y Cote Azur (20000004)
(
  '90000003-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000004-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'refill', 6000, 0.94, 5640, 'EUR',
  'Total Marine Cannes', 'Cannes Marina', 1840,
  'Pre-season top-up before charter season',
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent',
  (NOW() - INTERVAL '55 days')::date, (NOW() - INTERVAL '55 days')
),
(
  '90000004-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000004-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'consumption', 1800, NULL, NULL, 'EUR',
  '', 'Cannes → Saint-Tropez → Nice', 1862,
  'Charter week — 3 day passages',
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent',
  (NOW() - INTERVAL '30 days')::date, (NOW() - INTERVAL '30 days')
),
(
  '90000005-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000004-0000-0000-0000-000000000000' AND resource_type='fresh_water' LIMIT 1),
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'refill', 8000, 0.006, 48, 'EUR',
  'Port de Cannes', 'Cannes Marina', NULL,
  'Dockside water connection before charter season',
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont',
  (NOW() - INTERVAL '54 days')::date, (NOW() - INTERVAL '54 days')
),
(
  '90000006-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000004-0000-0000-0000-000000000000' AND resource_type='fresh_water' LIMIT 1),
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'consumption', 3200, NULL, NULL, 'EUR',
  '', 'On board', NULL,
  'Crew and guests — 14-day charter',
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont',
  (NOW() - INTERVAL '10 days')::date, (NOW() - INTERVAL '10 days')
),

-- Riviera Fleet – M/Y Belle Epoque (20000005)
(
  '90000007-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000005-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'refill', 5000, 0.91, 4550, 'EUR',
  'Repsol Antibes Marina', 'Port Vauban, Antibes', 3210,
  'Monthly top-up',
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent',
  (NOW() - INTERVAL '45 days')::date, (NOW() - INTERVAL '45 days')
),
(
  '90000008-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000005-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'consumption', 2200, NULL, NULL, 'EUR',
  '', 'Antibes → Monaco → Antibes', 3232,
  'Round trip for corporate charter — 2 days',
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont',
  (NOW() - INTERVAL '20 days')::date, (NOW() - INTERVAL '20 days')
),
(
  '90000009-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000005-0000-0000-0000-000000000000' AND resource_type='fresh_water' LIMIT 1),
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000',
  'refill', 6000, 0.006, 36, 'EUR',
  'Port Vauban', 'Antibes', NULL,
  'Pre-charter water fill',
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent',
  (NOW() - INTERVAL '44 days')::date, (NOW() - INTERVAL '44 days')
),

-- M/Y Neptune (20000006)
(
  '90000010-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'refill', 3500, 1.02, 3570, 'GBP',
  'MDL Hamble Point Marina', 'Hamble-le-Rice, UK', 1420,
  'Full fill before summer cruise to Channel Islands',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '60 days')::date, (NOW() - INTERVAL '60 days')
),
(
  '90000011-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'consumption', 980, NULL, NULL, 'GBP',
  '', 'Hamble → Guernsey', 1432,
  'Overnight crossing to Guernsey — 12 hours',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '45 days')::date, (NOW() - INTERVAL '45 days')
),
(
  '90000012-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'refill', 2000, 0.98, 1960, 'GBP',
  'Guernsey Fuel Services', 'St Peter Port, Guernsey', 1435,
  'Top-up at St Peter Port',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '40 days')::date, (NOW() - INTERVAL '40 days')
),
(
  '90000013-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='diesel_main' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'consumption', 1200, NULL, NULL, 'GBP',
  '', 'Guernsey → Jersey → Hamble', 1450,
  'Return trip via Jersey',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '30 days')::date, (NOW() - INTERVAL '30 days')
),
(
  '90000014-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='fresh_water' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'refill', 2000, 0.008, 16, 'GBP',
  'Hamble Point Marina', 'Hamble, UK', NULL,
  'Dockside water top-up on return',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '28 days')::date, (NOW() - INTERVAL '28 days')
),
(
  '90000015-0000-0000-0000-000000000000',
  (SELECT id FROM fuel_resources WHERE vessel_id='20000006-0000-0000-0000-000000000000' AND resource_type='fresh_water' LIMIT 1),
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000',
  'consumption', 900, NULL, NULL, 'GBP',
  '', 'On board', NULL,
  'Crew and family — 2-week cruise',
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington',
  (NOW() - INTERVAL '15 days')::date, (NOW() - INTERVAL '15 days')
)

ON CONFLICT (id) DO NOTHING;
