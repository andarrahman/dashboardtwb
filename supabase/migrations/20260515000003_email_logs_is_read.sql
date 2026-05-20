-- Add is_read column to contact_email_logs
-- DEFAULT true so all existing emails are treated as already read.
-- New inbound emails inserted by checkdailyemail.py will set is_read = false.
ALTER TABLE contact_email_logs
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT true;
