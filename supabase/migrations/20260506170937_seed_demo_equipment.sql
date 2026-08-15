/*
  # Seed Demo Equipment

  Inserts equipment for the demo vessels. All equipment belongs to Oceanic Luxury Yachts
  vessels (Azure Dream and Ocean Star).
*/

INSERT INTO equipment (id, vessel_id, company_id, name, type, manufacturer, model, serial_number, description, location, created_at)
VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Main Engine Port', 'Engine', 'MTU', '16V 4000 M93L', 'MTU-2018-001234', 'Port main propulsion engine', 'Engine Room - Port Side', '2025-01-20T10:00:00Z'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Main Engine Starboard', 'Engine', 'MTU', '16V 4000 M93L', 'MTU-2018-001235', 'Starboard main propulsion engine', 'Engine Room - Starboard Side', '2025-01-20T10:15:00Z'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Generator 1', 'Generator', 'Kohler', 'KOHLER 150REOZJF', 'KOH-2018-567890', 'Primary generator set', 'Generator Room', '2025-01-20T10:30:00Z'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Generator 2', 'Generator', 'Kohler', 'KOHLER 150REOZJF', 'KOH-2018-567891', 'Secondary generator set', 'Generator Room', '2025-01-20T10:45:00Z'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Watermaker Primary', 'Water System', 'HEM', 'WM-3500', 'HEM-2018-112233', 'Reverse osmosis watermaker', 'Technical Spaces - Lower Deck', '2025-01-20T11:00:00Z'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'HVAC Chiller Unit 1', 'HVAC', 'Heinen & Hopman', 'HH-CH-500', 'HH-2018-445566', 'Main HVAC chiller unit', 'HVAC Room', '2025-01-20T11:15:00Z'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Main Engine Port', 'Engine', 'CAT', 'C32 ACERT', 'CAT-2020-778899', 'Port main engine', 'Engine Room - Port', '2025-01-21T10:00:00Z'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Bow Thruster', 'Thruster', 'Servogear', 'SG-BT-350', 'SG-2020-334455', 'Hydraulic bow thruster', 'Bow Thruster Room', '2025-01-21T10:30:00Z')
ON CONFLICT (id) DO NOTHING;
