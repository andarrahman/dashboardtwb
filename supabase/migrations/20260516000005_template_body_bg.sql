ALTER TABLE marketing_templates
  ADD COLUMN IF NOT EXISTS body_bg_color VARCHAR(32) DEFAULT '#FFFFFF';
