ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_task_id);
