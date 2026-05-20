-- ─────────────────────────────────────────────────────────────────────────────
-- Project Management Module
-- Tables: projects, project_tasks, project_weekly_updates
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Per-workspace project code sequence support ───────────────────────────────
-- We store the next sequence number in a small helper table so PRJ codes are
-- scoped per workspace (PRJ-001 … PRJ-999+).
CREATE TABLE IF NOT EXISTS project_code_sequences (
  workspace_id uuid NOT NULL PRIMARY KEY,
  next_val     int  NOT NULL DEFAULT 1
);

ALTER TABLE project_code_sequences ENABLE ROW LEVEL SECURITY;

-- ── projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_code     text        NOT NULL,                        -- e.g. PRJ-001
  title            text        NOT NULL,
  field            text,                                         -- e.g. "Growth"
  department       text,                                         -- e.g. "Product & Growth"
  owner_id         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name       text,
  assignee_ids     uuid[]      NOT NULL DEFAULT '{}',
  assignees        jsonb       NOT NULL DEFAULT '[]',            -- [{id,name,avatar_url}]
  status           text        NOT NULL DEFAULT 'backlog'
                               CHECK (status IN ('backlog','in_progress','review','done','archived')),
  sprint           text,                                         -- e.g. "S-24 · Week 2"
  quarter          text,                                         -- e.g. "Q2 2026"
  start_date       date,
  due_date         date,
  progress         int         NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name  text,
  updated_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by_name  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,

  UNIQUE (workspace_id, project_code)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id  ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at    ON projects (deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id      ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_due_date      ON projects (due_date);

-- RLS: workspace members can read/write their workspace's projects
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── project_tasks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  status              text        NOT NULL DEFAULT 'backlog'
                                  CHECK (status IN ('backlog','planning','in_progress','review','done')),
  assignee_id         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  assignee_name       text,
  assignee_avatar_url text,
  start_date          date,
  due_date            date,
  sort_order          int         NOT NULL DEFAULT 0,
  created_by          uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name     text,
  updated_by          uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by_name     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id   ON project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_workspace_id ON project_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status       ON project_tasks (status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_deleted_at   ON project_tasks (deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_sort_order   ON project_tasks (project_id, sort_order);

CREATE POLICY "project_tasks_select" ON project_tasks
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "project_tasks_insert" ON project_tasks
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "project_tasks_update" ON project_tasks
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "project_tasks_delete" ON project_tasks
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ── project_weekly_updates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_weekly_updates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id         uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  week_start           date        NOT NULL,   -- Monday
  week_end             date        NOT NULL,   -- Sunday
  status               text        NOT NULL DEFAULT 'on_track'
                                   CHECK (status IN ('on_track','ongoing','behind')),
  result               text        NOT NULL DEFAULT '',
  concern              text,
  plus                 text,
  minus                text,
  submitted_by         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_by_name    text,
  submitted_at         timestamptz,
  is_draft             boolean     NOT NULL DEFAULT true,
  edit_window_closes_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,

  UNIQUE (project_id, week_start)
);

ALTER TABLE project_weekly_updates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pweekly_project_id   ON project_weekly_updates (project_id);
CREATE INDEX IF NOT EXISTS idx_pweekly_workspace_id ON project_weekly_updates (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pweekly_week_start   ON project_weekly_updates (week_start);
CREATE INDEX IF NOT EXISTS idx_pweekly_deleted_at   ON project_weekly_updates (deleted_at);

CREATE POLICY "pweekly_select" ON project_weekly_updates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pweekly_insert" ON project_weekly_updates
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pweekly_update" ON project_weekly_updates
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pweekly_delete" ON project_weekly_updates
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
