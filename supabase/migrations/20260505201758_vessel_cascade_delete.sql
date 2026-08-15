/*
  # Cascade Delete for Vessel Child Tables

  ## Summary
  When a vessel is deleted, all its related data should be deleted automatically
  to prevent orphaned records. This migration adds ON DELETE CASCADE to the
  vessel_id foreign key constraints across all child tables.

  ## Tables Modified
  - `equipment` — vessel_id FK → CASCADE
  - `maintenance_tasks` — vessel_id FK → CASCADE
  - `maintenance_history` — vessel_id FK → CASCADE
  - `inventory_items` — vessel_id FK → CASCADE
  - `stock_movements` — vessel_id FK → CASCADE (if exists)
  - `fuel_resources` — vessel_id FK → CASCADE
  - `fuel_log` — vessel_id FK → CASCADE
  - `operational_expenses` — vessel_id FK → CASCADE
  - `maintenance_manuals` — vessel_id FK → CASCADE

  ## Notes
  1. We drop and recreate each FK constraint with CASCADE.
  2. Uses IF EXISTS guards so it's safe to re-run.
  3. Does NOT delete any existing data — only changes the deletion behaviour going forward.
*/

-- equipment
DO $$ BEGIN
  ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_vessel_id_fkey;
  ALTER TABLE equipment
    ADD CONSTRAINT equipment_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- maintenance_tasks
DO $$ BEGIN
  ALTER TABLE maintenance_tasks DROP CONSTRAINT IF EXISTS maintenance_tasks_vessel_id_fkey;
  ALTER TABLE maintenance_tasks
    ADD CONSTRAINT maintenance_tasks_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- maintenance_history
DO $$ BEGIN
  ALTER TABLE maintenance_history DROP CONSTRAINT IF EXISTS maintenance_history_vessel_id_fkey;
  ALTER TABLE maintenance_history
    ADD CONSTRAINT maintenance_history_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- inventory_items
DO $$ BEGIN
  ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_vessel_id_fkey;
  ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- stock_movements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_vessel_id_fkey;
    ALTER TABLE stock_movements
      ADD CONSTRAINT stock_movements_vessel_id_fkey
      FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
  END IF;
END $$;

-- fuel_resources
DO $$ BEGIN
  ALTER TABLE fuel_resources DROP CONSTRAINT IF EXISTS fuel_resources_vessel_id_fkey;
  ALTER TABLE fuel_resources
    ADD CONSTRAINT fuel_resources_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- fuel_log
DO $$ BEGIN
  ALTER TABLE fuel_log DROP CONSTRAINT IF EXISTS fuel_log_vessel_id_fkey;
  ALTER TABLE fuel_log
    ADD CONSTRAINT fuel_log_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- operational_expenses
DO $$ BEGIN
  ALTER TABLE operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_vessel_id_fkey;
  ALTER TABLE operational_expenses
    ADD CONSTRAINT operational_expenses_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;

-- maintenance_manuals
DO $$ BEGIN
  ALTER TABLE maintenance_manuals DROP CONSTRAINT IF EXISTS maintenance_manuals_vessel_id_fkey;
  ALTER TABLE maintenance_manuals
    ADD CONSTRAINT maintenance_manuals_vessel_id_fkey
    FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
END $$;
