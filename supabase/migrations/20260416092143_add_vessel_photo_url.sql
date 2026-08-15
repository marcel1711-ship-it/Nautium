/*
  # Add photo_url to vessels table and create vessel-photos storage bucket

  1. Changes
    - Add `photo_url` column to the `vessels` table to store the URL of the vessel's photo
  
  2. Storage
    - Create public bucket `vessel-photos` for storing vessel images
    - Policies: authenticated users can upload/update/delete, public can view
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessels' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE vessels ADD COLUMN photo_url text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vessel-photos', 'vessel-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload vessel photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload vessel photos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'vessel-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update vessel photos'
  ) THEN
    CREATE POLICY "Authenticated users can update vessel photos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'vessel-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view vessel photos'
  ) THEN
    CREATE POLICY "Public can view vessel photos"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'vessel-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete vessel photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete vessel photos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'vessel-photos');
  END IF;
END $$;
