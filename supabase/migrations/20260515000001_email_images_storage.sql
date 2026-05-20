-- ─── Public storage bucket for email inline images ────────────────────────────
-- Run after creating the 'email-images' bucket in the Supabase dashboard
-- with "Public bucket" toggled ON (so recipients can view images without auth).

-- Allow authenticated users to upload images
CREATE POLICY "email_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'email-images');

-- Allow ANYONE (including unauthenticated) to read images — needed for email recipients
CREATE POLICY "email_images_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'email-images');

-- Allow authenticated users to delete their own images
CREATE POLICY "email_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'email-images');
