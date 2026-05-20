-- 0003_contacts
-- The core entity. Schema mirrors DATABASE.md v0.3:
--   * unified type column ('twibbonize' | 'external')
--   * sync vs CRM-managed columns kept side-by-side; the discipline lives
--     at the write site (sync job never writes to CRM-managed columns)
--   * soft delete only; RLS blocks hard deletes from clients
--   * generated FTS vector for global search
--   * NO owner_id (ownership lives in contact_assignments — future migration)

create table contacts (
  -- Identity
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  type                contact_type not null,

  -- Common (both types)
  name                text not null,
  email               citext,
  whatsapp_number     text,
  instagram_handle    citext,
  website_url         text,

  -- Twibbonize-only · synced (read-only in CRM)
  twibbonize_user_id      text,
  profile_url             text,
  account_tier            account_tier,
  country                 char(2),
  account_created_at      timestamptz,
  first_campaign_at       timestamptz,
  latest_campaign_at      timestamptz,
  total_campaigns         int,
  total_supporters        int,
  top_supporter_countries char(2)[],
  last_synced_at          timestamptz,

  -- Non-Twibbonize-only
  company             text,
  business_category   text,

  -- CRM-managed (sync NEVER writes here)
  summary_profile     text,
  segment             text,
  use_case_category   text,

  -- Custom fields (UC-S3)
  custom_fields       jsonb not null default '{}'::jsonb,

  -- Provenance (ownership handled separately in contact_assignments)
  created_by          uuid references profiles(id) on delete set null,

  -- Audit
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  deleted_by          uuid references profiles(id) on delete set null,

  -- FTS vector
  search              tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')),                   'A') ||
    setweight(to_tsvector('simple', coalesce(email::text, '')),            'B') ||
    setweight(to_tsvector('simple', coalesce(company, '')),                'B') ||
    setweight(to_tsvector('simple', coalesce(instagram_handle::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(whatsapp_number, '')),        'C') ||
    setweight(to_tsvector('simple', coalesce(website_url, '')),            'C')
  ) stored,

  -- Light DB-side validation. Primary validation lives at the API layer.
  constraint instagram_handle_no_at
    check (instagram_handle is null or instagram_handle !~ '^@'),
  constraint website_url_has_scheme
    check (website_url is null or website_url ~* '^https?://'),
  constraint external_has_no_creator_metrics
    check (
      type = 'twibbonize' or (
        account_tier        is null
        and total_campaigns    is null
        and total_supporters   is null
        and twibbonize_user_id is null
      )
    )
);

create trigger contacts_set_updated_at
before update on contacts
for each row execute function set_updated_at();

----------------------------------------------------------------------
-- Indexes
----------------------------------------------------------------------
create index contacts_alive       on contacts (workspace_id) where deleted_at is null;
create index contacts_type        on contacts (workspace_id, type) where deleted_at is null;
create index contacts_tier_active on contacts (workspace_id, account_tier)
  where deleted_at is null and type = 'twibbonize';
create index contacts_latest_camp on contacts (workspace_id, latest_campaign_at desc)
  where deleted_at is null;
create index contacts_country     on contacts (workspace_id, country) where deleted_at is null;
create index contacts_search_gin  on contacts using gin (search);
create index contacts_custom_gin  on contacts using gin (custom_fields);

create unique index contacts_email_unique
  on contacts (workspace_id, email)
  where deleted_at is null and email is not null;

create unique index contacts_twibbonize_id_unique
  on contacts (workspace_id, twibbonize_user_id)
  where deleted_at is null and twibbonize_user_id is not null;

create unique index contacts_instagram_unique
  on contacts (workspace_id, instagram_handle)
  where deleted_at is null and instagram_handle is not null;

----------------------------------------------------------------------
-- RLS
----------------------------------------------------------------------
alter table contacts enable row level security;

create policy contacts_read on contacts
for select using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
  )
);

create policy contacts_insert on contacts
for insert with check (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('admin','pm','sdr','mkt','cs')
  )
);

create policy contacts_update on contacts
for update using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
      and m.role in ('admin','pm','sdr','mkt','cs')
  )
);

-- Block hard deletes from any client. Service-role key bypasses RLS, so
-- server-side cleanup jobs (e.g. 30-day soft-delete purge) still work.
create policy contacts_no_hard_delete on contacts
for delete using (false);
