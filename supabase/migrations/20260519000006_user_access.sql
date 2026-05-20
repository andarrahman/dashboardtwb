-- Add user_type column for user access management roles
ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'staff'
CHECK (user_type IN ('admin', 'head', 'staff'));
