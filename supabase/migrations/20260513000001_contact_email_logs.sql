-- contact_email_logs
-- Stores inbound emails detected by checkdailyemail.py that match a CRM contact.
-- Shown in the Contact Quick View activity timeline.

create table if not exists contact_email_logs (
  id           uuid        primary key default gen_random_uuid(),
  contact_id   uuid        not null references contacts(id) on delete cascade,
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  from_email   text        not null,
  from_name    text,
  subject      text,
  received_at  timestamptz not null,
  created_at   timestamptz not null default now(),

  -- Prevent duplicate entries if script runs more than once
  unique (contact_id, from_email, received_at)
);

-- Index for quick lookup by contact
create index if not exists contact_email_logs_contact_id_idx
  on contact_email_logs (contact_id, received_at desc);

-- RLS
alter table contact_email_logs enable row level security;

-- Workspace members can read logs for their workspace
create policy "workspace members can read email logs"
  on contact_email_logs for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = contact_email_logs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Service role (used by the Python script) can insert
create policy "service role can insert email logs"
  on contact_email_logs for insert
  with check (true);

-- Service role can delete (for cleanup)
create policy "service role can delete email logs"
  on contact_email_logs for delete
  using (true);
