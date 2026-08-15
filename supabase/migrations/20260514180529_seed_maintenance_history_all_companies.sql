
/*
  # Seed maintenance history for all demo companies

  Adds realistic completed maintenance records for:
  - NineMoon Yachting (10000010): vessels 20000001, 20000002, 20000003
  - Riviera Fleet Management (10000020): vessels 20000004, 20000005
  - M/Y Neptune / Blue Horizon (10000030): vessel 20000006
*/

INSERT INTO maintenance_history (
  id, task_id, vessel_id, company_id, equipment_id,
  task_title, due_date, completion_date,
  completed_by_id, completed_by_name, completed_by_email,
  comments, photos, parts_used, external_service_cost, issues_detected, created_at
) VALUES

-- NineMoon – M/Y Luna Rossa
(
  '70000001-0000-0000-0000-000000000000',
  '40000001-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000001-0000-0000-0000-000000000000',
  'Port Engine 250hr Service',
  (NOW() - INTERVAL '40 days')::date, (NOW() - INTERVAL '38 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'Full 250hr service completed. Oil and filters changed, impeller replaced. Engine running smoothly.',
  ARRAY[]::text[],
  '[{"name":"MTU Engine Oil 10W40 20L","quantity":3,"inventory_id":"60000001-0000-0000-0000-000000000000"},{"name":"MTU Primary Fuel Filter","quantity":2,"inventory_id":"60000002-0000-0000-0000-000000000000"}]'::jsonb,
  0, '', (NOW() - INTERVAL '38 days')
),
(
  '70000002-0000-0000-0000-000000000000',
  '40000003-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000003-0000-0000-0000-000000000000',
  'Generator 1 Annual Service',
  (NOW() - INTERVAL '55 days')::date, (NOW() - INTERVAL '53 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'Annual service by Kohler certified technician. Oil, filters, belts replaced. Load test passed at 95% capacity.',
  ARRAY[]::text[],
  '[{"name":"Kohler Generator Oil Filter","quantity":2,"inventory_id":"60000004-0000-0000-0000-000000000000"}]'::jsonb,
  1200, '', (NOW() - INTERVAL '53 days')
),
(
  '70000003-0000-0000-0000-000000000000',
  '40000004-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000005-0000-0000-0000-000000000000',
  'Watermaker Membrane Flush',
  (NOW() - INTERVAL '90 days')::date, (NOW() - INTERVAL '89 days'),
  '2abf1601-2068-4fc0-91fb-14716e0ed15d', 'Luca Ferrari', 'captain@ninemoon.com',
  'Membranes flushed with cleaning solution. Production rate restored to 600L/h. Water quality tested OK.',
  ARRAY[]::text[], '[]'::jsonb,
  0, '', (NOW() - INTERVAL '89 days')
),
(
  '70000004-0000-0000-0000-000000000000',
  '40000005-0000-0000-0000-000000000000',
  '20000001-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000007-0000-0000-0000-000000000000',
  'AC System Pre-Season Check',
  (NOW() - INTERVAL '120 days')::date, (NOW() - INTERVAL '118 days'),
  '2abf1601-2068-4fc0-91fb-14716e0ed15d', 'Luca Ferrari', 'captain@ninemoon.com',
  'Full pre-season inspection. Refrigerant levels checked and topped up. All zones tested and functioning.',
  ARRAY[]::text[], '[]'::jsonb,
  480, '', (NOW() - INTERVAL '118 days')
),

-- NineMoon – S/Y Tramontana
(
  '70000005-0000-0000-0000-000000000000',
  '40000006-0000-0000-0000-000000000000',
  '20000002-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000008-0000-0000-0000-000000000000',
  'Main Engine Annual Service',
  (NOW() - INTERVAL '65 days')::date, (NOW() - INTERVAL '64 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'CAT C32 annual service completed. Oil, fuel filters, raw water impeller replaced. All systems nominal.',
  ARRAY[]::text[],
  '[{"name":"CAT DEO Engine Oil 10W30 20L","quantity":4,"inventory_id":"60000007-0000-0000-0000-000000000000"},{"name":"CAT C32 Primary Fuel Filter","quantity":2,"inventory_id":"60000008-0000-0000-0000-000000000000"}]'::jsonb,
  1800, '', (NOW() - INTERVAL '64 days')
),
(
  '70000006-0000-0000-0000-000000000000',
  '40000007-0000-0000-0000-000000000000',
  '20000002-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000009-0000-0000-0000-000000000000',
  'Bow Thruster Zinc Anodes',
  (NOW() - INTERVAL '180 days')::date, (NOW() - INTERVAL '178 days'),
  '2abf1601-2068-4fc0-91fb-14716e0ed15d', 'Luca Ferrari', 'captain@ninemoon.com',
  'Zinc anodes replaced during haul-out. 60% consumption on old anodes, within expected range.',
  ARRAY[]::text[],
  '[{"name":"Bow Thruster Zinc Anode Set","quantity":1,"inventory_id":"60000009-0000-0000-0000-000000000000"}]'::jsonb,
  0, '', (NOW() - INTERVAL '178 days')
),
(
  '70000007-0000-0000-0000-000000000000',
  '40000008-0000-0000-0000-000000000000',
  '20000002-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', NULL,
  'Standing Rigging Inspection',
  (NOW() - INTERVAL '200 days')::date, (NOW() - INTERVAL '197 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'Full rigging inspection by certified rigger. Replaced 2 worn swage fittings on forestay. All shrouds and stays within tolerance.',
  ARRAY[]::text[], '[]'::jsonb,
  2400, 'Two swage fittings on forestay showed early fatigue — replaced as precaution', (NOW() - INTERVAL '197 days')
),

-- NineMoon – M/Y Stella Maris
(
  '70000008-0000-0000-0000-000000000000',
  '40000009-0000-0000-0000-000000000000',
  '20000003-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', '30000010-0000-0000-0000-000000000000',
  'Port IPS Drive 500hr Service',
  (NOW() - INTERVAL '30 days')::date, (NOW() - INTERVAL '28 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'Volvo IPS 500hr service. Oil change, zincs replaced, bellows inspected. Drive in excellent condition.',
  ARRAY[]::text[], '[]'::jsonb,
  2200, '', (NOW() - INTERVAL '28 days')
),
(
  '70000009-0000-0000-0000-000000000000',
  '40000011-0000-0000-0000-000000000000',
  '20000003-0000-0000-0000-000000000000', '10000010-0000-0000-0000-000000000000', NULL,
  'Antifoul and Hull Clean',
  (NOW() - INTERVAL '365 days')::date, (NOW() - INTERVAL '360 days'),
  '431e3232-0f39-4429-9a52-39e8b33c0843', 'Marco Bellini', 'marco@ninemoon.com',
  'Full haul-out at Port Vell. Hull cleaned and two coats of antifoul applied. Zinc anodes replaced throughout.',
  ARRAY[]::text[],
  '[{"name":"Antifouling Paint 5L","quantity":8,"inventory_id":"60000005-0000-0000-0000-000000000000"}]'::jsonb,
  3800, '', (NOW() - INTERVAL '360 days')
),

-- Riviera Fleet – M/Y Cote Azur
(
  '70000010-0000-0000-0000-000000000000',
  '40000012-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000', '30000012-0000-0000-0000-000000000000',
  'Port Engine 200hr Service',
  (NOW() - INTERVAL '45 days')::date, (NOW() - INTERVAL '43 days'),
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', 'sophie@rivierafleet.com',
  'Volvo D13 200hr service completed. Oil and filters replaced. Running smoothly, no leaks detected.',
  ARRAY[]::text[],
  '[{"name":"Volvo D13 Engine Oil 5W40 4L","quantity":4,"inventory_id":"60000010-0000-0000-0000-000000000000"},{"name":"Volvo D13 Impeller","quantity":1,"inventory_id":"60000011-0000-0000-0000-000000000000"}]'::jsonb,
  0, '', (NOW() - INTERVAL '43 days')
),
(
  '70000011-0000-0000-0000-000000000000',
  '40000013-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000', NULL,
  'Safety Equipment Annual Check',
  (NOW() - INTERVAL '380 days')::date, (NOW() - INTERVAL '375 days'),
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', 'sophie@rivierafleet.com',
  'Annual safety inspection by MCA surveyor. EPIRB, life rafts, flares and fire extinguishers all certified.',
  ARRAY[]::text[],
  '[{"name":"SOLAS Flare Pack Exp 2027","quantity":2,"inventory_id":"60000012-0000-0000-0000-000000000000"}]'::jsonb,
  650, '', (NOW() - INTERVAL '375 days')
),
(
  '70000012-0000-0000-0000-000000000000',
  '40000014-0000-0000-0000-000000000000',
  '20000004-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000', '30000014-0000-0000-0000-000000000000',
  'Chartplotter Software Update',
  (NOW() - INTERVAL '60 days')::date, (NOW() - INTERVAL '60 days'),
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont', 'engineer@rivierafleet.com',
  'Garmin GPSMAP firmware updated to v34.00. All charts updated. AIS and radar integration verified.',
  ARRAY[]::text[], '[]'::jsonb,
  0, '', (NOW() - INTERVAL '60 days')
),

-- Riviera Fleet – M/Y Belle Epoque
(
  '70000013-0000-0000-0000-000000000000',
  '40000015-0000-0000-0000-000000000000',
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000', '30000015-0000-0000-0000-000000000000',
  'Port Engine Annual Service',
  (NOW() - INTERVAL '370 days')::date, (NOW() - INTERVAL '365 days'),
  '7af1703e-92b4-4093-94dd-cac62b2be069', 'Sophie Laurent', 'sophie@rivierafleet.com',
  'Full annual service by Volvo Penta dealer. All filters, belts, and zincs replaced. Sea trial completed successfully.',
  ARRAY[]::text[], '[]'::jsonb,
  2600, '', (NOW() - INTERVAL '365 days')
),
(
  '70000014-0000-0000-0000-000000000000',
  '40000016-0000-0000-0000-000000000000',
  '20000005-0000-0000-0000-000000000000', '10000020-0000-0000-0000-000000000000', NULL,
  'Bilge Pump Monthly Test',
  (NOW() - INTERVAL '35 days')::date, (NOW() - INTERVAL '34 days'),
  'eee3398c-62d4-4141-872a-14ff43f1cb31', 'Pierre Dupont', 'engineer@rivierafleet.com',
  'All 4 bilge pumps tested manually and via float switch. Pump 3 float switch had slight delay — cleaned contacts, re-tested OK.',
  ARRAY[]::text[], '[]'::jsonb,
  0, 'Pump 3 float switch sluggish — cleaned contacts, re-tested satisfactory', (NOW() - INTERVAL '34 days')
),

-- M/Y Neptune
(
  '70000015-0000-0000-0000-000000000000',
  '40000017-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '30000017-0000-0000-0000-000000000000',
  'Port Engine 150hr Service',
  (NOW() - INTERVAL '50 days')::date, (NOW() - INTERVAL '48 days'),
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', 'james@bluehorizon.io',
  'Volvo D6 150hr service. Engine oil and filters replaced. Impeller inspected and replaced. No issues found.',
  ARRAY[]::text[],
  '[{"name":"Volvo D6 Engine Oil 15W40 5L","quantity":3,"inventory_id":"60000013-0000-0000-0000-000000000000"},{"name":"Volvo D6 Impeller Kit","quantity":1,"inventory_id":"60000014-0000-0000-0000-000000000000"}]'::jsonb,
  0, '', (NOW() - INTERVAL '48 days')
),
(
  '70000016-0000-0000-0000-000000000000',
  '40000033-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '30000026-0000-0000-0000-000000000000',
  'Watermaker Membrane Flush',
  (NOW() - INTERVAL '90 days')::date, (NOW() - INTERVAL '88 days'),
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', 'james@bluehorizon.io',
  'Watermaker flushed and membranes cleaned. Output restored to 400L/h. Conductivity reading 350ppm — excellent.',
  ARRAY[]::text[], '[]'::jsonb,
  0, '', (NOW() - INTERVAL '88 days')
),
(
  '70000017-0000-0000-0000-000000000000',
  '40000018-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', NULL,
  'MCA Coded Vessel Safety Audit',
  (NOW() - INTERVAL '365 days')::date, (NOW() - INTERVAL '360 days'),
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', 'james@bluehorizon.io',
  'Annual MCA coded vessel audit passed. All safety equipment certified. Certificate valid until next year.',
  ARRAY[]::text[],
  '[{"name":"Hammar H20 HRU","quantity":1,"inventory_id":"60000015-0000-0000-0000-000000000000"}]'::jsonb,
  1800, '', (NOW() - INTERVAL '360 days')
),
(
  '70000018-0000-0000-0000-000000000000',
  '40000030-0000-0000-0000-000000000000',
  '20000006-0000-0000-0000-000000000000', '10000030-0000-0000-0000-000000000000', '30000023-0000-0000-0000-000000000000',
  'Radar Annual Calibration',
  (NOW() - INTERVAL '370 days')::date, (NOW() - INTERVAL '368 days'),
  'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73', 'James Harrington', 'james@bluehorizon.io',
  'Furuno radar calibrated by certified technician. Range accuracy and bearing verified. ARPA function tested.',
  ARRAY[]::text[], '[]'::jsonb,
  420, '', (NOW() - INTERVAL '368 days')
)

ON CONFLICT (id) DO NOTHING;
