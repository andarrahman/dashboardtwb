ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';
