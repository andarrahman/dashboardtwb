CREATE TABLE IF NOT EXISTS workspace_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  from_name text NOT NULL DEFAULT 'Twibbonize',
  from_email text NOT NULL DEFAULT 'noreply@twibbonize.com',
  reply_to text,
  resend_api_key text,
  resend_webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_all" ON workspace_email_settings
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
