-- ─── Discovery Call Module ────────────────────────────────────────────────────
-- Migration: 20250514000000_discovery_calls.sql

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE discovery_call_stage AS ENUM (
  'replied', 'waiting_reschedule', 'scheduled', 'waiting_result', 'finished', 'skipped'
);

CREATE TYPE discovery_call_lead_source AS ENUM (
  'email', 'whatsapp', 'linkedin', 'instagram'
);

CREATE TYPE discovery_call_survey_status AS ENUM (
  'not_sent', 'sent_pending', 'completed', 'skipped'
);

CREATE TYPE discovery_call_result AS ENUM (
  'pending', 'qualified', 'nurture', 'not_qualified'
);

CREATE TYPE discovery_call_next_action AS ENUM (
  'to_partnership', 'nurture_90d', 'archive', 'none'
);

CREATE TYPE discovery_call_skip_reason AS ENUM (
  'ghosted', 'declined', 'out_of_scope', 'duplicate', 'other'
);

CREATE TYPE discovery_call_reschedule_reason AS ENUM (
  'no_show', 'postponed_by_us', 'postponed_by_them', 'other'
);

-- ── Main table ────────────────────────────────────────────────────────────────

CREATE TABLE discovery_calls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id            UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  stage                 discovery_call_stage NOT NULL DEFAULT 'replied',
  owner_id              UUID NOT NULL REFERENCES auth.users(id),
  lead_source           discovery_call_lead_source NOT NULL,
  replied_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Interview
  interview_date        DATE,
  interview_time        TIME,
  interview_timezone    TEXT DEFAULT 'Asia/Jakarta',
  interview_meeting_url TEXT,

  -- Reschedule
  reschedule_count      INTEGER NOT NULL DEFAULT 0,
  reschedule_reason     discovery_call_reschedule_reason,
  reschedule_note       TEXT,

  -- Survey
  survey_status         discovery_call_survey_status NOT NULL DEFAULT 'not_sent',
  survey_sent_at        TIMESTAMPTZ,
  survey_completed_at   TIMESTAMPTZ,
  survey_response_id    UUID,

  -- Result
  result                discovery_call_result NOT NULL DEFAULT 'pending',
  result_decided_at     TIMESTAMPTZ,
  result_decided_by     UUID REFERENCES auth.users(id),
  next_action           discovery_call_next_action NOT NULL DEFAULT 'none',

  -- Skip
  skip_reason           discovery_call_skip_reason,
  skip_note             TEXT,

  -- Meta
  notes                 TEXT,
  last_stage_change_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  deleted_at            TIMESTAMPTZ
);

-- ── Stage history (append-only audit log) ────────────────────────────────────

CREATE TABLE discovery_call_stage_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_call_id   UUID NOT NULL REFERENCES discovery_calls(id) ON DELETE CASCADE,
  from_stage          discovery_call_stage,
  to_stage            discovery_call_stage NOT NULL,
  changed_by          UUID NOT NULL REFERENCES auth.users(id),
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason              TEXT
);

-- ── Comments ─────────────────────────────────────────────────────────────────

CREATE TABLE discovery_call_comments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_call_id   UUID NOT NULL REFERENCES discovery_calls(id) ON DELETE CASCADE,
  author_id           UUID NOT NULL REFERENCES auth.users(id),
  body                TEXT NOT NULL,
  mentions            UUID[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- ── Attachments ───────────────────────────────────────────────────────────────

CREATE TABLE discovery_call_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_call_id   UUID NOT NULL REFERENCES discovery_calls(id) ON DELETE CASCADE,
  storage_path        TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  mime_type           TEXT,
  size_bytes          BIGINT,
  uploaded_by         UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_dc_workspace_owner_stage
  ON discovery_calls (workspace_id, owner_id, stage)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dc_workspace_stage
  ON discovery_calls (workspace_id, stage)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dc_contact
  ON discovery_calls (contact_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dc_stage_activity
  ON discovery_calls (stage, last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dc_interview_date
  ON discovery_calls (interview_date)
  WHERE stage = 'scheduled' AND deleted_at IS NULL;

CREATE INDEX idx_dc_deleted
  ON discovery_calls (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_dc_history_call
  ON discovery_call_stage_history (discovery_call_id, changed_at DESC);

-- ── Auto-update timestamps ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_discovery_call_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dc_updated_at
  BEFORE UPDATE ON discovery_calls
  FOR EACH ROW EXECUTE FUNCTION update_discovery_call_timestamps();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE discovery_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_call_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_call_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_call_attachments ENABLE ROW LEVEL SECURITY;

-- discovery_calls
CREATE POLICY "dc_select_workspace_members"
  ON discovery_calls FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "dc_insert_workspace_members"
  ON discovery_calls FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND owner_id = auth.uid()
    AND created_by = auth.uid()
  );

CREATE POLICY "dc_update_owner_or_admin"
  ON discovery_calls FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = discovery_calls.workspace_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- discovery_call_stage_history
CREATE POLICY "dc_history_select"
  ON discovery_call_stage_history FOR SELECT
  USING (
    discovery_call_id IN (
      SELECT id FROM discovery_calls
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "dc_history_insert"
  ON discovery_call_stage_history FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- discovery_call_comments
CREATE POLICY "dc_comments_select"
  ON discovery_call_comments FOR SELECT
  USING (
    discovery_call_id IN (
      SELECT id FROM discovery_calls
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "dc_comments_insert"
  ON discovery_call_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "dc_comments_update"
  ON discovery_call_comments FOR UPDATE
  USING (author_id = auth.uid());

-- discovery_call_attachments
CREATE POLICY "dc_attachments_select"
  ON discovery_call_attachments FOR SELECT
  USING (
    discovery_call_id IN (
      SELECT id FROM discovery_calls
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "dc_attachments_insert"
  ON discovery_call_attachments FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "dc_attachments_delete"
  ON discovery_call_attachments FOR DELETE
  USING (uploaded_by = auth.uid());
