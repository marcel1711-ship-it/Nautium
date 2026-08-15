/*
  # Costs Module - Schema additions

  ## Summary
  Adds cost tracking capabilities across the platform:

  1. Modified Tables
    - `inventory_items`: adds `unit_cost` (numeric, optional) — unit purchase price of the part/consumable
    - `maintenance_tasks`: adds `external_service_cost` (numeric, optional) — cost of external labor/service when completing a task

  2. New Tables
    - `operational_expenses`: manual operational cost entries per vessel
      - `id` (uuid, pk)
      - `vessel_id` (uuid, fk vessels)
      - `company_id` (uuid, fk companies)
      - `category` (text) — mooring, electricity, water, internet, waste_disposal, port_fees, insurance, other
      - `description` (text)
      - `amount` (numeric)
      - `currency` (text, default 'USD')
      - `expense_date` (date)
      - `created_by` (uuid, fk auth.users)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on `operational_expenses`
    - Policies: select/insert/update/delete for authenticated users scoped to their company via user_profiles
*/

-- Add unit_cost to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'unit_cost'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN unit_cost numeric(12,2) DEFAULT NULL;
  END IF;
END $$;

-- Add external_service_cost to maintenance_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_tasks' AND column_name = 'external_service_cost'
  ) THEN
    ALTER TABLE maintenance_tasks ADD COLUMN external_service_cost numeric(12,2) DEFAULT NULL;
  END IF;
END $$;

-- Create operational_expenses table
CREATE TABLE IF NOT EXISTS operational_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid REFERENCES vessels(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operational_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view operational expenses"
  ON operational_expenses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Company members can insert operational expenses"
  ON operational_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Company members can update operational expenses"
  ON operational_expenses FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Company members can delete operational expenses"
  ON operational_expenses FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_operational_expenses_vessel_id ON operational_expenses(vessel_id);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_company_id ON operational_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_expense_date ON operational_expenses(expense_date);
