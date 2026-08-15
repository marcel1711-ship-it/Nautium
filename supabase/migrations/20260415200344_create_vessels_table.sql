/*
  # Create vessels table

  ## Summary
  Creates the vessels table to store yacht/vessel information linked to companies (customers).

  ## New Tables

  ### vessels
  - `id` - UUID primary key
  - `company_id` - FK to companies table (the customer/owner)
  - `name` - Vessel name
  - `type` - Vessel type (motor yacht, sailing yacht, catamaran, etc.)
  - `manufacturer` - Shipyard/builder name (e.g., Amels, Feadship, Lürssen)
  - `model` - Vessel model/series
  - `year_built` - Year of construction
  - `flag` - Flag state (country of registration)
  - `imo_number` - IMO number (international maritime org identifier)
  - `mmsi` - MMSI number for AIS tracking
  - `call_sign` - Radio call sign
  - `registration_id` - Official registration number
  - `length_overall` - LOA in meters
  - `beam` - Beam in meters
  - `gross_tonnage` - Gross tonnage (GT)
  - `location` - Current port/location
  - `description` - General description
  - `notes` - Additional notes
  - `created_at` / `updated_at` - Timestamps

  ## Security
  - RLS enabled
  - Authenticated users can read vessels belonging to their company
  - Only master_admin can insert/update/delete vessels (for now)

  ## Notes
  1. company_id links vessel to a customer company
  2. manufacturer field enables filtering by shipyard (e.g., all Amels yachts)
  3. location tracks where the yacht is currently berthed
*/

CREATE TABLE IF NOT EXISTS vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'motor_yacht',
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year_built integer,
  flag text NOT NULL DEFAULT '',
  imo_number text NOT NULL DEFAULT '',
  mmsi text NOT NULL DEFAULT '',
  call_sign text NOT NULL DEFAULT '',
  registration_id text NOT NULL DEFAULT '',
  length_overall numeric,
  beam numeric,
  gross_tonnage numeric,
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vessels of their company"
  ON vessels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = vessels.company_id
    )
  );

CREATE POLICY "Authenticated users can insert vessels"
  ON vessels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = vessels.company_id
    )
  );

CREATE POLICY "Authenticated users can update vessels"
  ON vessels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = vessels.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = vessels.company_id
    )
  );

CREATE POLICY "Authenticated users can delete vessels"
  ON vessels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = vessels.company_id
    )
  );

CREATE INDEX IF NOT EXISTS vessels_company_id_idx ON vessels(company_id);
