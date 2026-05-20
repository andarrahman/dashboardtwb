-- ─── Storage policies for dc-attachments bucket ──────────────────────────────
-- Run after creating the 'dc-attachments' bucket in the Supabase dashboard.

-- Allow authenticated users to upload files
CREATE POLICY "dc_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dc-attachments');

-- Allow authenticated users to read files
CREATE POLICY "dc_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dc-attachments');

-- Allow authenticated users to delete their own files
CREATE POLICY "dc_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dc-attachments');
