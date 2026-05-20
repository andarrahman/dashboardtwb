# Twibbonize CRM — Database

> Status: **v0.1 — design draft, contacts only**
> Stack: PostgreSQL 15 (via Supabase), Drizzle/SQL migrations
> Multi-tenant: every domain row carries `workspace_id`
> Spec source: `CRM-Internal-Epics-Stories-UseCases.md`

This document tracks the schema as it exists today. When the schema changes, update this file in the same PR.

---

## 1. Principles

1. **Unified contact schema.** Twibbonize User and Non-Twibbonize User share one `contacts` table, distinguished by `type`. Creator-only fields are nullable; for Premium Supporters and external contacts they're simply empty. (Resolved in spec §8.)
2. **Sync writes ≠ CRM writes.** The scheduled sync job only writes synced columns. CRM-managed columns (`summary_profile`, `segment`, `use_case_category`, `whatsapp_number`) are never touched by sync.
3. **Soft delete only from clients.** All client queries filter `where deleted_at is null`. Hard delete is reserved for server-side service-role operations.
4. **Scope every query by `workspace_id`.** Enforced by RLS; do not rely on application-side filtering alone.
5. **JSONB for custom fields, not EAV.** UC-S3 is satisfied by `contacts.custom_fields jsonb`.

---

## 2. Extensions

```sql
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email
create extension if not exists "pg_trgm";   -- fuzzy search (V2)
```

---

## 3. Enums

```sql
create type contact_type as enum ('twibbonize', 'external');
create type account_tier as enum ('free', 'premium_creator', 'premium_supporter');
```

Future enums (when the corresponding tables ship):

- `activity_category` — `outreach | system | edit`
- `activity_type` — `email_sent | email_received | whatsapp_sent | whatsapp_received | call_logged | meeting | note | sync_update | conversion | merged | soft_deleted | restored | field_edit`
- `partnership_stage` — `prospect | discovery | proposal | negotiation | active | inactive`
- `workspace_role` — `admin | pm | sdr | mkt | cs | viewer`

---

## 4. Tables

### 4.1 `contacts` — the core entity

```sql
create table contacts (
  -- Identity
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  type                contact_type not null,

  -- Common (both types)
  name                text not null,
  email               citext,
  whatsapp_number     text,                          -- E.164, e.g. +6281234567890
  instagram_handle    citext,                        -- without leading "@", e.g. "auliapratiwi"
  website_url         text,                          -- normalized to include scheme, e.g. https://aulia.id

  ----- Twibbonize-only · SYNCED (read-only in CRM) -----
  twibbonize_user_id  text,
  profile_url         text,
  account_tier        account_tier,
  country             char(2),                       -- ISO 3166-1 alpha-2
  account_created_at  timestamptz,
  first_campaign_at   timestamptz,
  latest_campaign_at  timestamptz,
  total_campaigns     int,
  total_supporters    int,
  top_supporter_countries char(2)[],
  last_synced_at      timestamptz,

  ----- Non-Twibbonize-only -----
  company             text,
  business_category   text,                          -- free-form V1 (open Q #3)

  ----- CRM-managed (both types · sync NEVER writes here) -----
  summary_profile     text,
  segment             text,
  use_case_category   text,

  -- Custom fields (UC-S3)
  custom_fields       jsonb not null default '{}'::jsonb,

  -- Provenance (ownership handled out-of-band — see §5)
  created_by          uuid references profiles(id) on delete set null,

  -- Audit
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  deleted_by          uuid references profiles(id) on delete set null,

  -- Search vector (FTS for global search)
  search              tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')),               'A') ||
    setweight(to_tsvector('simple', coalesce(email::text, '')),        'B') ||
    setweight(to_tsvector('simple', coalesce(company, '')),            'B') ||
    setweight(to_tsvector('simple', coalesce(instagram_handle::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(whatsapp_number, '')),    'C') ||
    setweight(to_tsvector('simple', coalesce(website_url, '')),        'C')
  ) stored,

  -- Light validation (DB-side belt; primary validation is at the API layer)
  constraint instagram_handle_no_at
    check (instagram_handle is null or instagram_handle !~ '^@'),
  constraint website_url_has_scheme
    check (website_url is null or website_url ~* '^https?://'),

  constraint external_has_no_creator_metrics
    check (
      type = 'twibbonize' or (
        account_tier is null
        and total_campaigns is null
        and total_supporters is null
        and twibbonize_user_id is null
      )
    )
);
```

**Field rules (matching the spec)**

| Field | Source | Editable in CRM? | Notes |
|---|---|---|---|
| `name`, `email`, `country`, `account_tier`, `total_campaigns`, `total_supporters`, `account_created_at`, `first_campaign_at`, `latest_campaign_at`, `top_supporter_countries`, `profile_url` | Synced (Twibbonize) | No | Refreshed by scheduled job (UC-C9) |
| `whatsapp_number` | Synced if available, otherwise CRM | Yes | Primary channel for WA outreach |
| `instagram_handle` | CRM | Yes | Stored without `@`. Lowercased via `citext` so duplicates collapse |
| `website_url` | CRM | Yes | Store normalized with scheme (`https://…`). Validate at the API layer |
| `summary_profile`, `segment`, `use_case_category` | CRM | Yes | Never overwritten by sync |
| `company`, `business_category` | CRM (external only) | Yes | V1 free-text; normalize to `companies` later |
| `custom_fields` | CRM | Yes | Per-workspace dynamic fields (UC-S3) |

### 4.2 Indexes

```sql
-- Most queries scope by workspace + alive
create index contacts_alive       on contacts (workspace_id) where deleted_at is null;
create index contacts_type        on contacts (workspace_id, type)     where deleted_at is null;
create index contacts_tier_active on contacts (workspace_id, account_tier)
  where deleted_at is null and type = 'twibbonize';
create index contacts_latest_camp on contacts (workspace_id, latest_campaign_at desc)
  where deleted_at is null;
create index contacts_country     on contacts (workspace_id, country) where deleted_at is null;
create index contacts_search_gin  on contacts using gin (search);
create index contacts_custom_gin  on contacts using gin (custom_fields);

-- Uniqueness, scoped per workspace, only among alive rows
create unique index contacts_email_unique
  on contacts (workspace_id, email)
  where deleted_at is null and email is not null;

create unique index contacts_twibbonize_id_unique
  on contacts (workspace_id, twibbonize_user_id)
  where deleted_at is null and twibbonize_user_id is not null;

-- Optional uniqueness for Instagram handle (collapse duplicates per workspace).
-- Drop or relax this if multiple contacts may legitimately share a handle.
create unique index contacts_instagram_unique
  on contacts (workspace_id, instagram_handle)
  where deleted_at is null and instagram_handle is not null;
```

### 4.3 Triggers

```sql
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_set_updated_at
before update on contacts
for each row execute function set_updated_at();
```

### 4.4 Row Level Security

```sql
alter table contacts enable row level security;

create policy contacts_read on contacts
for select using (
  exists (
    select 1 from workspace_members m
    where m.workspace_id = contacts.workspace_id
      and m.user_id = auth.uid()
  )
);

create policy contacts_write on contacts
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

-- Block hard deletes from any client (only service-role can hard delete)
create policy contacts_no_hard_delete on contacts
for delete using (false);
```

---

## 5. Adjacent tables (planned, not yet built)

These are referenced above by FK or are needed before `contacts` is fully usable in production. They're listed here for context; full schemas land in their own sections when built.

| Table | Purpose | When |
|---|---|---|
| `workspaces` | Multi-tenant root | **Required before contacts** |
| `profiles` | App-level user record (mirrors `auth.users`) | **Required before contacts** |
| `workspace_members` | `(workspace_id, user_id, role)` → drives RLS | **Required before contacts** |
| `contact_assignments` | `(contact_id, user_id, role, assigned_at)` — replaces the inlined `owner_id`. Lets multiple roles touch one contact (PM + CS), supports reassignment history, and avoids tying ownership to a single nullable FK. The "primary owner" is the most recent or role-prioritized row | **Required for owner-aware features** (My contacts tab, dashboard widgets, notifications) |
| `companies` | First-class company object (open Q #4 → recommend V1) | V1 |
| `contact_activities` | Activity timeline events (UC-C12, §"Activity timeline") | V1 |
| `segments` | Saved filter rules (UC-C6, UC-C7) — JSONB rules | V1 |
| `contact_merges` | Audit trail for merges (UC-C5) | V1 |
| `audit_log` | Admin actions (UC-S6) | V1 |
| `partnerships`, `partnership_stage_history` | Pipeline (E4) | V1 |
| `email_threads`, `email_messages` | Per-user OAuth email log | V2 |
| `wa_messages` | WhatsApp Business API messages | V2 |
| `sequences`, `sequence_steps`, `sequence_enrollments` | Multi-step cadences with auto-pause-on-reply | V2 |

---

## 6. Conversion & merge behavior

### 6.1 Non-Twibbonize → Twibbonize User (UC-C10)

Triggered by the sync job when a non-Twibbonize contact's `email` matches a newly-created Twibbonize user. Implementation:

1. Locate the non-Twibbonize row in the same workspace by `email`.
2. `update contacts set type='twibbonize', twibbonize_user_id=…, profile_url=…, …synced columns…, last_synced_at=now() where id = …`.
3. CRM-managed columns are preserved.
4. Insert a `contact_activities` row with `type='conversion'`.
5. Notify the assigned owner (resolved via `contact_assignments`, see §5) in-app + email.

### 6.2 Manual shadow record (UC-C11)

User adds a Twibbonize User by email or username before sync sees them. Inserted with:

- `type='twibbonize'`
- `twibbonize_user_id` may be `null` initially
- All synced columns null until first matching sync

The unique index on `(workspace_id, twibbonize_user_id)` is partial (`where … is not null`), so multiple `null`-id shadow rows can coexist, but real ids are unique.

### 6.3 Merge (UC-C5)

Synced fields auto-win on the Twibbonize User side. CRM-managed fields are resolved per-field by the user via merge UI, then written to the surviving row. The losing row's `contact_activities` are reparented to the survivor; the loser is soft-deleted with a `contact_merges` audit row.

---

## 7. Open questions blocking final shape

These are still TBD per `CRM-Internal-Epics-Stories-UseCases.md` §8. Each affects either schema or where the data lives.

| Q | Impact on this schema |
|---|---|
| Sync source(s) for Twibbonize User fields (#1) | Determines how `last_synced_at` granularity is set and whether per-field sync timestamps are needed |
| Sync cadence (#2) | If real-time, consider an outbox/CDC approach instead of scheduled upsert |
| Business category controlled list (#3) | Either keep `text` or convert to FK to a `business_categories` reference table |
| Companies as first-class objects (#4) | Add `company_id uuid references companies(id)` to `contacts`; soft-deprecate the `company text` column |
| Hosting region (#7) | Drives whether this lives in Supabase (Singapore) or RDS Jakarta (PDP) |
| Auth strategy (#8) | If Google SSO only, `profiles` doesn't need `password_hash` columns |

---

## 8. Migration plan

V1 migrations land in `supabase/migrations/` (naming: `YYYYMMDDHHMMSS_<slug>.sql`). Suggested order:

1. `0001_init_extensions.sql` — extensions + enums
2. `0002_workspaces.sql` — workspaces + profiles + workspace_members + RLS
3. `0003_contacts.sql` — this file's schema
4. `0004_companies.sql` — and add `contacts.company_id`
5. `0005_contact_activities.sql`
6. `0006_segments.sql`
7. `0007_partnerships.sql`
8. `0008_audit_log.sql`

---

## 9. Changelog

| Version | Date | Change |
|---|---|---|
| v0.3 | 2026-05-10 | Remove `owner_id` from `contacts`. Ownership moves to a dedicated `contact_assignments` table (see §5). Drops `contacts_owner` index. Spec features that depend on owner (My contacts, dashboard widgets, conversion notifications) now resolve owner via that table. |
| v0.2 | 2026-05-10 | Add `instagram_handle` (citext, no leading `@`) and `website_url` (must include scheme) as CRM-managed fields. Indexed Instagram for per-workspace uniqueness. Both added to FTS vector. |
| v0.1 | 2026-05-10 | Initial draft. Contacts table with sync/CRM split, soft delete, RLS, FTS, custom_fields. |
