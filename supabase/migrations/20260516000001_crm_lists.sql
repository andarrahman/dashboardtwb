-- crm_lists
CREATE TABLE IF NOT EXISTS crm_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  folder VARCHAR(100),
  owner_id UUID,
  owner_name VARCHAR(200),
  contact_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  created_by_name VARCHAR(200),
  updated_by UUID,
  updated_by_name VARCHAR(200)
);

ALTER TABLE crm_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON crm_lists FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- crm_list_contacts
CREATE TABLE IF NOT EXISTS crm_list_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES crm_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID,
  added_by_name VARCHAR(200),
  UNIQUE(list_id, contact_id)
);

ALTER TABLE crm_list_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON crm_list_contacts FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
