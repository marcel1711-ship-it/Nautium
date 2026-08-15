/*
  # Create Fuel & Consumables Tracking Tables

  ## Summary
  Adds two tables to track operational resources on vessels:
  - `fuel_resources`: defines each resource per vessel (e.g., Diesel Main Engines, Fresh Water, Generator Diesel)
    with tank capacity and current level.
  - `fuel_log`: records every refill or consumption event, linked to a resource.

  ## New Tables

  ### `fuel_resources`
  Defines a trackable resource tank/system on a vessel.
  - `id` – UUID primary key
  - `vessel_id` – FK to vessels
  - `company_id` – FK for RLS scoping
  - `name` – e.g. "Diesel Main Engines"
  - `resource_type` – enum: diesel_main, diesel_generator, fresh_water, engine_oil, hydraulic_oil, grey_water, black_water, other
  - `unit` – L / kg / m3
  - `capacity` – max capacity in unit
  - `current_level` – current level in unit
  - `low_level_alert` – threshold that triggers warning
  - `notes`
  - `created_at`, `updated_at`

  ### `fuel_log`
  Immutable log of every movement (refill or consumption).
  - `id` – UUID primary key
  - `resource_id` – FK to fuel_resources
  - `vessel_id` – for convenience / filtering
  - `company_id` – for RLS
  - `entry_type` – 'refill' | 'consumption'
  - `quantity` – amount added (positive) or consumed (positive, entry_type tells direction)
  - `price_per_unit` – optional, relevant for diesel refills
  - `total_cost` – optional
  - `currency` – e.g. EUR, USD
  - `supplier` – port / supplier name
  - `location` – where the refill happened
  - `engine_hours` – engine hours at time of log (useful for consumption tracking)
  - `notes`
  - `logged_by_id`
  - `logged_by_name`
  - `log_date` – date of the event
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Authenticated users can access their company's data
*/

-- Resource type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_type_enum') THEN
    CREATE TYPE resource_type_enum AS ENUM (
      'diesel_main',
      'diesel_generator',
      'fresh_water',
      'engine_oil',
      'hydraulic_oil',
      'grey_water',
      'black_water',
      'other'
    );
  END IF;
END $$;

-- fuel_resources table
CREATE TABLE IF NOT EXISTS fuel_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL,
  company_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  resource_type resource_type_enum NOT NULL DEFAULT 'diesel_main',
  unit text NOT NULL DEFAULT 'L',
  capacity numeric NOT NULL DEFAULT 0,
  current_level numeric NOT NULL DEFAULT 0,
  low_level_alert numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select their company fuel resources"
  ON fuel_resources FOR SELECT
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can insert their company fuel resources"
  ON fuel_resources FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can update their company fuel resources"
  ON fuel_resources FOR UPDATE
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can delete their company fuel resources"
  ON fuel_resources FOR DELETE
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- fuel_log table
CREATE TABLE IF NOT EXISTS fuel_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES fuel_resources(id) ON DELETE CASCADE,
  vessel_id uuid NOT NULL,
  company_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('refill', 'consumption')),
  quantity numeric NOT NULL DEFAULT 0,
  price_per_unit numeric,
  total_cost numeric,
  currency text NOT NULL DEFAULT 'EUR',
  supplier text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  engine_hours numeric,
  notes text NOT NULL DEFAULT '',
  logged_by_id uuid,
  logged_by_name text NOT NULL DEFAULT '',
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select their company fuel log"
  ON fuel_log FOR SELECT
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can insert their company fuel log"
  ON fuel_log FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can update their company fuel log"
  ON fuel_log FOR UPDATE
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Authenticated users can delete their company fuel log"
  ON fuel_log FOR DELETE
  TO authenticated
  USING (company_id = (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fuel_resources_vessel_id ON fuel_resources(vessel_id);
CREATE INDEX IF NOT EXISTS idx_fuel_resources_company_id ON fuel_resources(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_resource_id ON fuel_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_vessel_id ON fuel_log(vessel_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_company_id ON fuel_log(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_log_log_date ON fuel_log(log_date DESC);
