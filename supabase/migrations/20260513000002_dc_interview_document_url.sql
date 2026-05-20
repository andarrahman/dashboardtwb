-- Add interview_document_url column to discovery_calls
-- Separate from interview_meeting_url (video call link):
--   interview_meeting_url  → Zoom / Google Meet join link (shows "Join" button on card)
--   interview_document_url → Google Docs / Notion interview brief (shows "Doc" link on card)

alter table discovery_calls
  add column if not exists interview_document_url text;
