DROP POLICY IF EXISTS "workspace members can access templates" ON marketing_templates;

CREATE POLICY "workspace_access" ON marketing_templates FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
