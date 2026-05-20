-- ─── Marketing Templates ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  name            VARCHAR(120) NOT NULL,
  subject_line    VARCHAR(255),
  preview_text    VARCHAR(255),
  category        VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  blocks          JSONB NOT NULL DEFAULT '[]',
  html_content    TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  is_shared       BOOLEAN NOT NULL DEFAULT false,
  owner_id        UUID,
  owner_name      VARCHAR(120),
  created_by      UUID,
  created_by_name VARCHAR(120),
  updated_by      UUID,
  updated_by_name VARCHAR(120),
  times_used      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ
);

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS marketing_templates_workspace_id_idx
  ON marketing_templates (workspace_id);

CREATE INDEX IF NOT EXISTS marketing_templates_workspace_status_idx
  ON marketing_templates (workspace_id, status);

CREATE INDEX IF NOT EXISTS marketing_templates_workspace_category_idx
  ON marketing_templates (workspace_id, category);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_templates_updated_at ON marketing_templates;
CREATE TRIGGER marketing_templates_updated_at
  BEFORE UPDATE ON marketing_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE marketing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can access templates" ON marketing_templates;
CREATE POLICY "workspace members can access templates"
  ON marketing_templates
  FOR ALL
  USING (
    workspace_id::text = (auth.jwt() ->> 'workspace_id')
  );
