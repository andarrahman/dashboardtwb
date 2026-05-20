CREATE TABLE IF NOT EXISTS project_activity_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL,
  actor_id      uuid NOT NULL,
  actor_name    text NOT NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  entity_title  text,
  meta          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_project ON project_activity_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_workspace ON project_activity_logs(workspace_id);
