/*
  # Add customer type and vessel management fields

  ## Overview
  This migration adds fields to support different customer types (yacht owner vs agency)
  and vessel management limits for pricing purposes.

  ## Changes
  1. Add customer_type field (yacht_owner or agency)
  2. Add yacht_name field (for single yacht owners)
  3. Add vessel_limit field (maximum vessels allowed to manage)
  4. Add default constraints and indexes

  ## Notes
  - Yacht owners typically manage 1 vessel
  - Agencies/companies can manage multiple vessels based on their plan
  - Vessel limit affects pricing tiers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'customer_type'
  ) THEN
    ALTER TABLE companies ADD COLUMN customer_type text NOT NULL DEFAULT 'agency';
    ALTER TABLE companies ADD CONSTRAINT valid_customer_type CHECK (customer_type IN ('yacht_owner', 'agency'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'yacht_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN yacht_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'vessel_limit'
  ) THEN
    ALTER TABLE companies ADD COLUMN vessel_limit integer NOT NULL DEFAULT 1;
    ALTER TABLE companies ADD CONSTRAINT valid_vessel_limit CHECK (vessel_limit > 0 AND vessel_limit <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_customer_type ON companies(customer_type);
CREATE INDEX IF NOT EXISTS idx_companies_vessel_limit ON companies(vessel_limit);