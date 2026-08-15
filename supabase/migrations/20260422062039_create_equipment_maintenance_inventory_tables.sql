/*
  # Create core operational tables

  ## New Tables
  1. equipment - Vessel equipment registry
  2. maintenance_tasks - Preventive maintenance schedule
  3. maintenance_history - Completed task audit trail
  4. inventory_items - Spare parts and consumables
  5. stock_movements - Inventory change log
  6. maintenance_manuals - Document repository

  ## Security
  - RLS enabled on all tables
  - Policies based on company_id and vessel_id from user metadata
*/

-- Helper function to check if a user has access to a vessel
CREATE OR REPLACE FUNCTION user_has_vessel_access(p_vessel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR (
      EXISTS (
        SELECT 1 FROM vessels v
        JOIN companies c ON c.id = v.company_id
        WHERE v.id = p_vessel_id
        AND c.id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
      )
    )
    OR (
      p_vessel_id::text IN (
        SELECT jsonb_array_elements_text(raw_user_meta_data->'vessel_ids')
        FROM auth.users WHERE id = auth.uid()
      )
    );
$$;

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  installation_date date,
  specifications text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view equipment for their vessels"
  ON equipment FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Maintenance tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  frequency text NOT NULL DEFAULT 'monthly',
  custom_interval_days integer,
  last_completed_date date,
  next_due_date date NOT NULL,
  reminder_days_before integer[] DEFAULT '{}',
  assigned_user_id uuid,
  required_parts jsonb DEFAULT '[]',
  estimated_duration_hours numeric DEFAULT 0,
  instructions text NOT NULL DEFAULT '',
  checklist_items text[] DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due_soon', 'overdue', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maintenance tasks for their vessels"
  ON maintenance_tasks FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert maintenance tasks"
  ON maintenance_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update maintenance tasks"
  ON maintenance_tasks FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete maintenance tasks"
  ON maintenance_tasks FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Maintenance history table
CREATE TABLE IF NOT EXISTS maintenance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES maintenance_tasks(id) ON DELETE SET NULL,
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  task_title text NOT NULL DEFAULT '',
  due_date date,
  completion_date timestamptz NOT NULL DEFAULT now(),
  completed_by_id uuid,
  completed_by_name text NOT NULL DEFAULT '',
  completed_by_email text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  photos text[] DEFAULT '{}',
  parts_used jsonb DEFAULT '[]',
  issues_detected text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maintenance history for their vessels"
  ON maintenance_history FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert maintenance history"
  ON maintenance_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update maintenance history"
  ON maintenance_history FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete maintenance history"
  ON maintenance_history FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'spare_part' CHECK (type IN ('spare_part', 'consumable')),
  part_number text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  supplier_email text NOT NULL DEFAULT '',
  supplier_phone text NOT NULL DEFAULT '',
  current_stock integer NOT NULL DEFAULT 0,
  minimum_stock integer NOT NULL DEFAULT 1,
  unit_of_measure text NOT NULL DEFAULT 'pcs',
  storage_location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  photo_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory for their vessels"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert inventory items"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update inventory items"
  ON inventory_items FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete inventory items"
  ON inventory_items FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  reference_id uuid,
  performed_by_id uuid,
  performed_by_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock movements for their vessels"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update stock movements"
  ON stock_movements FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete stock movements"
  ON stock_movements FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Maintenance manuals table
CREATE TABLE IF NOT EXISTS maintenance_manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_by_id uuid,
  uploaded_by_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view manuals for their vessels"
  ON maintenance_manuals FOR SELECT
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

CREATE POLICY "Users can insert manuals"
  ON maintenance_manuals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update manuals"
  ON maintenance_manuals FOR UPDATE
  TO authenticated
  USING (user_has_vessel_access(vessel_id))
  WITH CHECK (true);

CREATE POLICY "Users can delete manuals"
  ON maintenance_manuals FOR DELETE
  TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_vessel_id ON equipment(vessel_id);
CREATE INDEX IF NOT EXISTS idx_equipment_company_id ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_vessel_id ON maintenance_tasks(vessel_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_company_id ON maintenance_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_next_due_date ON maintenance_tasks(next_due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_vessel_id ON maintenance_history(vessel_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_company_id ON maintenance_history(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_vessel_id ON inventory_items(vessel_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_manuals_vessel_id ON maintenance_manuals(vessel_id);
