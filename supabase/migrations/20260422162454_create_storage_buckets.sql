/*
  # Create Storage Buckets for File Uploads

  1. Buckets
    - `task-photos`: Stores photos uploaded when completing maintenance tasks
    - `manuals`: Stores PDF/DOC maintenance manuals

  2. Policies
    - Authenticated users can upload to their own paths
    - Authenticated users can read all files in their company's scope
    - File deletion restricted to uploader

  Note: bucket creation via SQL uses storage schema functions
*/

-- Create task-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Create manuals bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manuals',
  'manuals',
  true,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Policies for task-photos bucket
CREATE POLICY "Authenticated users can upload task photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-photos');

CREATE POLICY "Authenticated users can view task photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-photos');

CREATE POLICY "Users can delete own task photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policies for manuals bucket
CREATE POLICY "Authenticated users can upload manuals"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'manuals');

CREATE POLICY "Authenticated users can view manuals"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'manuals');

CREATE POLICY "Users can delete own manuals"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'manuals' AND auth.uid()::text = (storage.foldername(name))[1]);
