-- Email suppression list
CREATE TABLE IF NOT EXISTS email_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS email_suppression_email_idx ON email_suppression(email);
CREATE INDEX IF NOT EXISTS email_suppression_workspace_idx ON email_suppression(workspace_id);

ALTER TABLE email_suppression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_all" ON email_suppression
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Email deliverability logs (for dashboard)
CREATE TABLE IF NOT EXISTS email_deliverability_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('delivered', 'bounced', 'complained', 'opened', 'clicked')),
  resend_email_id text,
  subject text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edl_workspace_idx ON email_deliverability_logs(workspace_id);
CREATE INDEX IF NOT EXISTS edl_event_type_idx ON email_deliverability_logs(event_type);
CREATE INDEX IF NOT EXISTS edl_created_at_idx ON email_deliverability_logs(created_at);

ALTER TABLE email_deliverability_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_read" ON email_deliverability_logs
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "service_role_insert" ON email_deliverability_logs
  FOR INSERT WITH CHECK (true);

-- Add email_status to contacts if not exists
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'active' CHECK (email_status IN ('active', 'bounced', 'complained', 'unsubscribed'));
