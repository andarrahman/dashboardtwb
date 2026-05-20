CREATE TABLE IF NOT EXISTS contact_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  contact_id UUID,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_unsubscribes_token_idx ON contact_unsubscribes (token);
CREATE INDEX IF NOT EXISTS contact_unsubscribes_email_idx ON contact_unsubscribes (email);

-- Enable RLS
ALTER TABLE contact_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_all" ON contact_unsubscribes
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
-- Allow public insert (for unsubscribe page - no auth)
CREATE POLICY "public_insert" ON contact_unsubscribes
  FOR INSERT TO anon
  WITH CHECK (true);
