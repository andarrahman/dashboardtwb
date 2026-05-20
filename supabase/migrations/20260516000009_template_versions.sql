CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES marketing_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]',
  html_content TEXT,
  bg_color VARCHAR(32),
  font_family TEXT,
  body_bg_color VARCHAR(32),
  email_width INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_name VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS template_versions_template_id_idx ON template_versions (template_id, version_number DESC);
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_via_template" ON template_versions
  FOR ALL TO authenticated
  USING (
    template_id IN (
      SELECT id FROM marketing_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
