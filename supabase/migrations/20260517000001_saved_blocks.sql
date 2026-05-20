-- Saved block snippets table
CREATE TABLE IF NOT EXISTS saved_blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  block jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text
);

ALTER TABLE saved_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_blocks' AND policyname = 'workspace_members_read_saved_blocks') THEN
    CREATE POLICY "workspace_members_read_saved_blocks" ON saved_blocks
      FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_blocks' AND policyname = 'workspace_members_insert_saved_blocks') THEN
    CREATE POLICY "workspace_members_insert_saved_blocks" ON saved_blocks
      FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_blocks' AND policyname = 'workspace_members_delete_saved_blocks') THEN
    CREATE POLICY "workspace_members_delete_saved_blocks" ON saved_blocks
      FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;
