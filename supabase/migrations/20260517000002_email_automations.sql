-- Email Automations (main table)
CREATE TABLE IF NOT EXISTS email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled workflow',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type text CHECK (trigger_type IN ('list_subscription', 'form_submitted', 'date_time', 'contact_inactive', 'custom_event', 'twibbonize_campaign')),
  trigger_config jsonb DEFAULT '{}',
  steps jsonb DEFAULT '[]',
  goal text,
  total_enrolled integer DEFAULT 0,
  total_completed integer DEFAULT 0,
  avg_open_rate numeric(5,2),
  avg_click_rate numeric(5,2),
  owner_id uuid REFERENCES profiles(id),
  owner_name text,
  created_by uuid REFERENCES profiles(id),
  created_by_name text,
  updated_by uuid REFERENCES profiles(id),
  updated_by_name text,
  published_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Automation Enrollments
CREATE TABLE IF NOT EXISTS automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_index integer DEFAULT 0,
  current_step_name text,
  next_action_at timestamptz,
  next_step_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'exited', 'error')),
  exit_reason text,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation Activity Logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  contact_id uuid REFERENCES contacts(id),
  event_type text NOT NULL CHECK (event_type IN ('enrolled', 'email_sent', 'opened', 'clicked', 'exited', 'error', 'workflow_edit', 'paused', 'resumed', 'published')),
  event_label text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "workspace_members_can_read_automations" ON email_automations
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
CREATE POLICY "workspace_members_can_insert_automations" ON email_automations
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
CREATE POLICY "workspace_members_can_update_automations" ON email_automations
  FOR UPDATE USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "workspace_members_can_read_enrollments" ON automation_enrollments
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
CREATE POLICY "workspace_members_can_manage_enrollments" ON automation_enrollments
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "workspace_members_can_read_logs" ON automation_logs
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
CREATE POLICY "workspace_members_can_insert_logs" ON automation_logs
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );
