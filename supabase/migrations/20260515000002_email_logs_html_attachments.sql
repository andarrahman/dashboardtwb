-- Add body_html and attachments columns to contact_email_logs
ALTER TABLE contact_email_logs
  ADD COLUMN IF NOT EXISTS body_html   text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
