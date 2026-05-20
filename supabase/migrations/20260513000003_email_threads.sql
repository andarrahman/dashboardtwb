-- ─── Email Threads & Messages ─────────────────────────────────────────────────
-- Threads group messages for one contact conversation.
-- Messages are individual sent/received/draft emails within a thread.

-- Status enum
CREATE TYPE email_status AS ENUM ('draft', 'sent', 'scheduled', 'replied');
CREATE TYPE email_direction AS ENUM ('outbound', 'inbound');

-- ─── Threads ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_threads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id          uuid REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject             text NOT NULL DEFAULT '',
  status              email_status NOT NULL DEFAULT 'draft',
  last_message_at     timestamptz,
  message_count       int NOT NULL DEFAULT 0,
  -- Stale tracking: set when outbound, no inbound reply after N days
  is_stale            boolean NOT NULL DEFAULT false,
  stale_since_days    int,
  -- Scheduling
  scheduled_at        timestamptz,
  -- AI
  ai_generated        boolean NOT NULL DEFAULT false,
  ai_tone             text,
  -- Audit
  created_by          uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direction     email_direction NOT NULL DEFAULT 'outbound',
  from_email    text,
  to_email      text,
  cc_emails     text[] NOT NULL DEFAULT '{}',
  bcc_emails    text[] NOT NULL DEFAULT '{}',
  body          text,
  body_html     text,
  attachments   jsonb NOT NULL DEFAULT '[]',
  sent_at       timestamptz,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_threads_workspace   ON email_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact     ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_owner       ON email_threads(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status      ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_deleted     ON email_threads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread     ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_workspace  ON email_messages(workspace_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE email_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can read/write threads & messages
CREATE POLICY "workspace_members_threads" ON email_threads
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_messages" ON email_messages
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
