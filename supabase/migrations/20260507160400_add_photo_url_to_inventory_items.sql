/*
  # Add photo_url to inventory_items

  ## Changes
  - Adds `photo_url` column (text, nullable) to `inventory_items` table if it doesn't exist yet.
    This stores the public URL of an uploaded part photo in Supabase Storage.

  ## Notes
  - Safe to run multiple times (IF NOT EXISTS guard)
  - No data loss — existing rows get NULL which is the correct default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN photo_url text;
  END IF;
END $$;
