/*
  # Add photos array to maintenance_tasks

  ## Changes
  - Adds `photos` column (text[]) to `maintenance_tasks` table to store reference photo URLs
    for the task itself (e.g. "before" photos, equipment state, reference images).
    This is separate from `maintenance_history.photos` which are completion/work photos.

  ## Notes
  - Default is empty array so existing rows are unaffected
  - Uses IF NOT EXISTS guard to be safe on re-runs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenance_tasks' AND column_name = 'photos'
  ) THEN
    ALTER TABLE maintenance_tasks ADD COLUMN photos text[] DEFAULT '{}';
  END IF;
END $$;
