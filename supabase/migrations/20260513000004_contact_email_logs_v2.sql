-- Extend contact_email_logs with direction, to_email, body_preview, thread_id
-- (these were missing from the initial migration)

ALTER TABLE contact_email_logs
  ADD COLUMN IF NOT EXISTS direction    text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS to_email     text,
  ADD COLUMN IF NOT EXISTS body_preview text,
  ADD COLUMN IF NOT EXISTS thread_id    uuid REFERENCES email_threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_email_logs_thread_id_idx ON contact_email_logs(thread_id);

-- Allow workspace members to insert (for outbound emails logged from CRM)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'workspace members can insert email logs'
      AND tablename = 'contact_email_logs'
  ) THEN
    CREATE POLICY "workspace members can insert email logs"
      ON contact_email_logs FOR INSERT
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
