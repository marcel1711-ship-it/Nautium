/*
  # Add external_service_cost to maintenance_history

  Adds the external_service_cost column to maintenance_history to track
  the cost of external technicians or service providers when completing a task.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_history' AND column_name = 'external_service_cost'
  ) THEN
    ALTER TABLE maintenance_history ADD COLUMN external_service_cost numeric(12,2) DEFAULT NULL;
  END IF;
END $$;
