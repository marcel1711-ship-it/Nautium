/*
  # Seed M/Y Neptune — Full Inventory & Operational Costs

  M/Y Neptune (vessel_id: 20000006, company: Blue Horizon Charter Co.)
  previously had only 3 inventory items and 9 cost entries.

  1. Adds 20 inventory items — filters, lubricants, engine parts, safety,
     electrical, deck, galley. All types are 'spare_part' or 'consumable'.
  2. Adds 24 operational expense entries covering 12 months of realistic
     running costs across all categories.
*/

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================

INSERT INTO inventory_items (
  id, vessel_id, company_id, equipment_id,
  name, type, part_number, serial_number, description, category,
  supplier_name, supplier_email, supplier_phone,
  current_stock, minimum_stock, unit_of_measure, storage_location,
  notes, unit_cost, created_at
) VALUES

-- Engine parts — Volvo D6
('A1000001-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000017-0000-0000-0000-000000000000',
 'Volvo D6 Engine Oil Filter','consumable','VOL-23658613','','Spin-on oil filter for Volvo D6 diesel engine','Filters',
 'Volvo Penta UK','parts@volvopenta.co.uk','+44 1904 611177',
 4,2,'pcs','Engine Room — Port Locker','Replace every 250h or annually',32.50,NOW()-INTERVAL '300 days'),

('A1000002-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000017-0000-0000-0000-000000000000',
 'Volvo D6 Fuel Filter Primary','consumable','VOL-3840833','','Primary fuel filter element for Volvo D6','Filters',
 'Volvo Penta UK','parts@volvopenta.co.uk','+44 1904 611177',
 3,2,'pcs','Engine Room — Port Locker','Replace every 500h or annually',28.00,NOW()-INTERVAL '300 days'),

('A1000003-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000017-0000-0000-0000-000000000000',
 'Volvo D6 Raw Water Impeller','spare_part','VOL-21951346','','Jabsco impeller for Volvo D6 raw water pump','Engine Parts',
 'Jabsco Marine','sales@jabsco.com','+44 1604 622 422',
 2,2,'pcs','Engine Room — Port Locker','Inspect annually — replace at signs of wear',45.00,NOW()-INTERVAL '300 days'),

('A1000004-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000018-0000-0000-0000-000000000000',
 'Volvo D6 Engine Oil VDS-4.5 20L','consumable','VOL-22215570','','Volvo Penta premium engine oil 15W-40 20L drum','Lubricants',
 'Volvo Penta UK','parts@volvopenta.co.uk','+44 1904 611177',
 3,2,'drum','Engine Room — Starboard Locker','Use VDS-4.5 specification only',95.00,NOW()-INTERVAL '300 days'),

('A1000005-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000017-0000-0000-0000-000000000000',
 'Volvo D6 Drive Belt Set','spare_part','VOL-3803826','','Alternator & auxiliary drive belt kit for Volvo D6','Engine Parts',
 'Volvo Penta UK','parts@volvopenta.co.uk','+44 1904 611177',
 1,1,'set','Engine Room — Port Locker','Keep one complete set as emergency spare',62.00,NOW()-INTERVAL '300 days'),

-- Generator
('A1000006-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000019-0000-0000-0000-000000000000',
 'Fischer Panda Gen Oil Filter','consumable','FP-9000-0418','','Oil filter for Fischer Panda 8 kW generator','Filters',
 'Fischer Panda UK','service@fischerpanda.co.uk','+44 1732 225 655',
 4,2,'pcs','Generator Compartment','Replace every 250h',22.00,NOW()-INTERVAL '280 days'),

('A1000007-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000019-0000-0000-0000-000000000000',
 'Fischer Panda Gen Fuel Filter','consumable','FP-9000-0317','','Fuel filter element for Fischer Panda generator','Filters',
 'Fischer Panda UK','service@fischerpanda.co.uk','+44 1732 225 655',
 3,2,'pcs','Generator Compartment','Replace every 500h',18.50,NOW()-INTERVAL '280 days'),

-- Bow thruster
('A1000008-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000024-0000-0000-0000-000000000000',
 'Hydraulic Fluid HV46 5L','consumable','BP-HV46-5L','','BP Energol hydraulic fluid ISO 46 for bow thruster system','Lubricants',
 'BP Marine','marine@bp.com','+44 800 028 0053',
 4,2,'can','Engine Room — Hydraulics Cabinet','Top up as needed — check level monthly',28.00,NOW()-INTERVAL '280 days'),

-- Watermaker
('A1000009-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000026-0000-0000-0000-000000000000',
 'Watermaker Prefilter Cartridge 10"','consumable','WM-PF-10-5','','5 micron sediment prefilter for reverse osmosis watermaker','Filters',
 'Spectra Watermakers','info@spectrawatermakers.com','+1 415 526 2780',
 6,4,'pcs','Forward Locker','Replace monthly during heavy use',8.50,NOW()-INTERVAL '280 days'),

('A1000010-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000','30000026-0000-0000-0000-000000000000',
 'Watermaker RO Membrane 4040','spare_part','WM-MEM-4040','','RO membrane element 4 x 40 inch for watermaker','Engine Parts',
 'Spectra Watermakers','info@spectrawatermakers.com','+1 415 526 2780',
 1,1,'pcs','Forward Locker','Service life approx 3 years — inspect annually',320.00,NOW()-INTERVAL '280 days'),

-- Safety
('A1000011-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'CO2 Fire Extinguisher 5 kg','spare_part','KD-5KG-CO2','SE-2024-0082','CO2 extinguisher for engine room — MED approved','Safety',
 'Kidde Marine','marine@kidde.co.uk','+44 1753 558 040',
 2,2,'pcs','Engine Room','Annual inspection — next due Jan 2027',98.00,NOW()-INTERVAL '260 days'),

('A1000012-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'SOLAS Flare Kit 4-pack','consumable','OC-FL4-SOLAS','','SOLAS approved parachute & handheld flares','Safety',
 'Ocean Signal','info@oceansignal.com','+44 1403 714 713',
 2,2,'set','Safety Locker — Companionway','Check expiry — replace every 3 years',145.00,NOW()-INTERVAL '260 days'),

('A1000013-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Lifejacket 150N Auto Inflate','spare_part','CRE-150N-AUTO','LJ-2023-A01','Auto-inflate lifejacket 150N MED approved','Safety',
 'Crewsaver','info@crewsaver.com','+44 2392 528 621',
 6,6,'pcs','Cockpit Locker Starboard','Inspect & service annually — last serviced Jan 2026',185.00,NOW()-INTERVAL '260 days'),

('A1000014-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Lifejacket Rearming Kit 33g','consumable','CRE-ARM-33G','','Replacement CO2 cylinder & pill for 150N lifejackets','Safety',
 'Crewsaver','info@crewsaver.com','+44 2392 528 621',
 6,6,'pcs','Safety Locker','Replace after deployment or annual service',22.50,NOW()-INTERVAL '260 days'),

-- Electrical
('A1000015-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Fuse Kit Assorted Marine','consumable','BEP-FK-ASS','','Assorted blade & glass fuses for 12V/24V systems','Electrical',
 'BEP Marine','sales@bepmarine.com','+64 9 274 0700',
 2,1,'kit','Electrical Panel Locker','Keep one full kit on board',18.00,NOW()-INTERVAL '250 days'),

('A1000016-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'LED Navigation Light Bulb Set','spare_part','HELLA-LED-SET','','Replacement LED bulbs for masthead, steaming, stern lights','Electrical',
 'Hella Marine','marine@hella.com','+49 2521 290',
 1,1,'set','Electrical Panel Locker','Replace every 5 years or at failure',45.00,NOW()-INTERVAL '250 days'),

-- Deck & Rigging
('A1000017-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Mooring Line 14mm x 10m','consumable','STA-MOO-14-10','','3-strand nylon mooring line with eye splice','Deck',
 'Stazo Marine','info@stazo.com','+31 299 403 911',
 4,2,'pcs','Foredeck Locker','Inspect annually — replace when worn',38.00,NOW()-INTERVAL '240 days'),

('A1000018-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Fender 600mm x 150mm White','consumable','TEN-F6-WHT','','Cylindrical inflatable fender with rope','Deck',
 'Tenders & Fenders UK','sales@tendersandfenders.co.uk','+44 23 8045 6789',
 6,4,'pcs','Cockpit Locker Port','Inspect for wear before each season',32.00,NOW()-INTERVAL '240 days'),

-- Paint
('A1000019-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Antifouling Paint 2.5L Dark Blue','consumable','INT-AF-DB25','','Interspeed 640 antifouling paint 2.5L','Paints',
 'International Paints','marine@international-pc.com','+44 23 8022 6722',
 4,2,'can','Paint Locker','Apply annually at haul-out',72.00,NOW()-INTERVAL '220 days'),

-- Galley
('A1000020-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',NULL,
 'Gas Cartridge 450g Propane','consumable','CAM-PRO-450','','Propane gas cartridge for backup stove','Galley',
 'Calor Gas','customer@calor.co.uk','+44 800 626 626',
 8,4,'pcs','Galley Locker','Keep 8 units minimum on offshore passages',6.50,NOW()-INTERVAL '200 days')

ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- OPERATIONAL EXPENSES — 12 months of realistic costs
-- ============================================================

INSERT INTO operational_expenses (
  id, vessel_id, company_id,
  category, description, amount, currency, expense_date,
  created_by, created_at
) VALUES

('B1000001-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Spring haul-out — antifoul, hull polish, anode replacement',2850.00,'GBP','2025-04-08',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '400 days'),

('B1000002-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'fuel','Main engine fuel — Hamble Marina pre-season fill',2940.00,'GBP','2025-04-10',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '398 days'),

('B1000003-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'mooring','MDL Hamble Point Marina — summer berthing Apr–Sep',4200.00,'GBP','2025-04-15',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '393 days'),

('B1000004-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Volvo D6 500h service — filters, belts, coolant flush',1480.00,'GBP','2025-04-22',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '386 days'),

('B1000005-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'insurance','Pantaenius yacht insurance annual premium 2025',5950.00,'GBP','2025-05-01',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '378 days'),

('B1000006-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'port_fees','Cowes Week 2025 — race entry & pontoon fees',420.00,'GBP','2025-07-28',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '290 days'),

('B1000007-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'fuel','Fuel refill — Cowes, Isle of Wight',680.00,'GBP','2025-07-30',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '288 days'),

('B1000008-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'crew','Delivery skipper — Hamble to Dartmouth & return',950.00,'GBP','2025-08-12',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '275 days'),

('B1000009-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'port_fees','Dartmouth Royal Regatta — 3 nights marina',195.00,'GBP','2025-08-26',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '261 days'),

('B1000010-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Watermaker membrane service & prefilter replacement',380.00,'GBP','2025-09-05',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '251 days'),

('B1000011-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'internet','Iridium GO satellite comms — monthly subscription Sep 25',95.00,'GBP','2025-09-14',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '242 days'),

('B1000012-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'mooring','MDL Hamble Point Marina — winter berthing Oct–Mar',3800.00,'GBP','2025-10-01',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '225 days'),

('B1000013-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Fischer Panda generator 250h service',620.00,'GBP','2025-10-14',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '212 days'),

('B1000014-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'repairs','Bow thruster hydraulic seal replacement',1250.00,'GBP','2025-10-28',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '198 days'),

('B1000015-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Lifejacket annual service — 6 units',270.00,'GBP','2025-11-10',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '185 days'),

('B1000016-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'internet','Iridium GO satellite comms — monthly subscription Nov 25',95.00,'GBP','2025-11-14',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '181 days'),

('B1000017-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'repairs','Navigation light refit — masthead & steaming light LED upgrade',340.00,'GBP','2025-12-02',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '163 days'),

('B1000018-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'waste_disposal','Certified waste oil & bilge water disposal — Hamble Marina',85.00,'GBP','2025-12-18',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '147 days'),

('B1000019-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Volvo D6 port engine mount replacement',880.00,'GBP','2026-01-15',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '119 days'),

('B1000020-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'insurance','MCA small commercial vessel compliance survey',1100.00,'GBP','2026-02-03',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '100 days'),

('B1000021-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'internet','Iridium GO satellite comms — monthly subscription Feb 26',95.00,'GBP','2026-02-14',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '89 days'),

('B1000022-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'maintenance','Spring bottom paint & topsides polish — Hamble boatyard',1650.00,'GBP','2026-03-18',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '57 days'),

('B1000023-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'fuel','Pre-season fuel fill — MDL Hamble',3570.00,'GBP','2026-03-25',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '50 days'),

('B1000024-0000-0000-0000-000000000000','20000006-0000-0000-0000-000000000000','10000030-0000-0000-0000-000000000000',
 'provisions','Charter provisions & safety equipment restocking',485.00,'GBP','2026-04-02',
 'abfc5551-dfbc-4ee5-8ac0-79dad4e2ac73',NOW()-INTERVAL '42 days')

ON CONFLICT (id) DO NOTHING;
