# Discovery Call · Database (Supabase)

Tables, columns, and relationships for the Discovery Call module. Naming follows Supabase / Postgres conventions (snake_case, `uuid` PKs, `timestamptz` timestamps, `auth.users` for owner references).

## Enums

| Enum | Values |
|---|---|
| `discovery_call_stage` | `replied`, `waiting_reschedule`, `scheduled`, `waiting_result`, `finished`, `skipped` |
| `discovery_call_lead_source` | `email`, `whatsapp`, `linkedin`, `instagram` |
| `discovery_call_survey_status` | `not_sent`, `sent_pending`, `completed`, `skipped` |
| `discovery_call_result` | `pending`, `qualified`, `nurture`, `not_qualified` |
| `discovery_call_next_action` | `to_partnership`, `nurture_90d`, `archive`, `none` |
| `discovery_call_skip_reason` | `ghosted`, `declined`, `out_of_scope`, `duplicate`, `other` |
| `discovery_call_reschedule_reason` | `no_show`, `postponed_by_us`, `postponed_by_them`, `other` |

## Table: `discovery_calls`

One row per card on the Kanban.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| id | uuid | yes | `gen_random_uuid()` | PK |
| workspace_id | uuid | yes | — | FK → `workspaces.id` |
| contact_id | uuid | yes | — | FK → `contacts.id` |
| stage | discovery_call_stage | yes | `replied` | Pipeline column |
| owner_id | uuid | yes | `auth.uid()` | FK → `auth.users.id`, locked to creator |
| lead_source | discovery_call_lead_source | yes | — | How prospect reached out |
| replied_at | timestamptz | yes | `now()` | Entry into pipeline |
| interview_date | date | no | — | Set in Scheduled stage |
| interview_time | time | no | — | Paired with `interview_date` |
| interview_timezone | text | no | `Asia/Jakarta` | IANA tz string |
| interview_meeting_url | text | no | — | Zoom / Meet / etc. |
| reschedule_count | integer | yes | `0` | Increments on re-entry to Waiting Reschedule |
| reschedule_reason | discovery_call_reschedule_reason | conditional | — | Required when `stage = waiting_reschedule` |
| reschedule_note | text | no | — | Free-form context |
| survey_status | discovery_call_survey_status | yes | `not_sent` | — |
| survey_sent_at | timestamptz | no | — | — |
| survey_completed_at | timestamptz | no | — | — |
| survey_response_id | uuid | no | — | Link to external survey response if integrated |
| result | discovery_call_result | yes | `pending` | Decision when stage = finished |
| result_decided_at | timestamptz | no | — | Stamped on finish |
| result_decided_by | uuid | no | — | FK → `auth.users.id` |
| next_action | discovery_call_next_action | yes | `none` | Hand-off path when finished |
| skip_reason | discovery_call_skip_reason | conditional | — | Required when `stage = skipped` |
| skip_note | text | no | — | — |
| notes | text | no | — | Free-form, supports Markdown |
| last_stage_change_at | timestamptz | yes | `now()` | Used for time-in-stage chip |
| last_activity_at | timestamptz | yes | `now()` | Stale detection |
| created_at | timestamptz | yes | `now()` | — |
| updated_at | timestamptz | yes | `now()` | — |
| created_by | uuid | yes | `auth.uid()` | FK → `auth.users.id` |
| updated_by | uuid | no | — | FK → `auth.users.id` |
| deleted_at | timestamptz | no | — | Soft delete · auto-purge after 30 days |

## Table: `discovery_call_stage_history`

Append-only audit log of stage transitions. Powers the Edit modal timeline and the contact activity feed.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| discovery_call_id | uuid | FK → `discovery_calls.id` (cascade) |
| from_stage | discovery_call_stage | null on first insert |
| to_stage | discovery_call_stage | required |
| changed_by | uuid | FK → `auth.users.id` |
| changed_at | timestamptz | default `now()` |
| reason | text | optional context (carries `reschedule_note` / `skip_note` when relevant) |

## Table: `discovery_call_comments`

Internal team notes attached to a card.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| discovery_call_id | uuid | FK → `discovery_calls.id` (cascade) |
| author_id | uuid | FK → `auth.users.id` |
| body | text | required |
| mentions | uuid[] | array of mentioned user ids |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |
| deleted_at | timestamptz | soft delete |

## Table: `discovery_call_attachments`

Files (meeting notes, screenshots, recordings) stored in the `discovery-call-attachments` Supabase Storage bucket.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| discovery_call_id | uuid | FK → `discovery_calls.id` (cascade) |
| storage_path | text | bucket object key (`{workspace_id}/{call_id}/{file}`) |
| file_name | text | original filename |
| mime_type | text | — |
| size_bytes | bigint | — |
| uploaded_by | uuid | FK → `auth.users.id` |
| uploaded_at | timestamptz | default `now()` |

## Relationships

- `discovery_calls.workspace_id` → `workspaces.id`
- `discovery_calls.contact_id` → `contacts.id`
- `discovery_calls.owner_id` → `auth.users.id`
- `discovery_call_stage_history.discovery_call_id` → `discovery_calls.id` (cascade delete)
- `discovery_call_comments.discovery_call_id` → `discovery_calls.id` (cascade delete)
- `discovery_call_attachments.discovery_call_id` → `discovery_calls.id` (cascade delete)

## Storage bucket

- Bucket id: `discovery-call-attachments`
- Public: `false`
- Path convention: `{workspace_id}/{discovery_call_id}/{uuid}-{filename}`
