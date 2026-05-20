-- ─── Public storage bucket for email template images ─────────────────────────

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-images',
  'template-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_images_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "template_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'template-images');
  END IF;
END $$;

-- Allow anyone (including email recipients) to read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_images_select_public' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "template_images_select_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'template-images');
  END IF;
END $$;

-- Allow authenticated users to update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_images_update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "template_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'template-images');
  END IF;
END $$;

-- Allow authenticated users to delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_images_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "template_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'template-images');
  END IF;
END $$;
