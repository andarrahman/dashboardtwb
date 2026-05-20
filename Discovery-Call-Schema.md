# Discovery Call — Schema & Pipeline Spec

Part of **Epic 3 · Outreach Creator**. The Discovery Call sub-module is a 6-stage Kanban that tracks every prospect from the moment they reply until the conversation reaches a result.

## Pipeline stages (left → right)

1. **Replied Email/Whatsapp** — Prospect has replied to outreach. Card lands here on creation.
2. **Waiting Reschedule** — Interview missed, no-showed, or postponed; awaiting a new slot.
3. **Scheduled** — Interview is on the calendar with a date and time.
4. **Waiting Result** — Interview happened. Awaiting survey completion or stakeholder review.
5. **Finished** — Decision made. `result` is one of Qualified, Nurture, Not qualified.
6. **Skipped** — Prospect dropped without resolution. Requires `skip_reason`. Excluded from pipeline metrics by default.

Stage order matters: Waiting Reschedule sits before Scheduled because reschedule cards need triage before normal scheduled calls.

## Card data (visible on every Kanban card)

- Contact avatar + name
- Tier · Country (Twibbonize) or Company · Category (Non-Twibbonize)
- 3-dot menu (Edit / Move to stage / Open contact / Copy link / Delete)
- Data pill: **Interview date** · **Survey completed?** · **Result**
- Time-in-stage chip (color-coded: calendar for upcoming, danger for stale, clock for waiting)
- Owner avatar

## Database

### Table: `discovery_calls`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| contact_id | uuid | FK → contacts.id, NOT NULL, indexed |
| stage | enum | `replied`, `waiting_reschedule`, `scheduled`, `waiting_result`, `finished`, `skipped`. Default `replied` |
| owner_id | uuid | FK → users.id, NOT NULL. Set on create from auth.uid(). Immutable except via admin reassign |
| lead_source | enum | `email`, `whatsapp`, `linkedin`, `instagram`. NOT NULL on create |
| replied_at | timestamptz | When the prospect first replied (entry into pipeline) |
| interview_date | date | Nullable until scheduled |
| interview_time | time | Nullable |
| interview_timezone | text | Default user's tz (e.g. `Asia/Jakarta`) |
| interview_meeting_url | text | Nullable. Zoom/Meet/etc. |
| reschedule_count | integer | Default 0. Increments when entering `waiting_reschedule` |
| reschedule_reason | text | Required when stage = `waiting_reschedule` |
| survey_status | enum | `not_sent`, `sent_pending`, `completed`, `skipped`. Default `not_sent` |
| survey_sent_at | timestamptz | Nullable |
| survey_completed_at | timestamptz | Nullable |
| survey_response_id | uuid | Nullable. FK → external survey if integrated |
| result | enum | `pending`, `qualified`, `nurture`, `not_qualified`. Default `pending` |
| result_decided_at | timestamptz | Nullable |
| result_decided_by | uuid | FK → users.id, nullable |
| next_action | enum | `to_partnership`, `nurture_90d`, `archive`, `none`. Relevant when stage = `finished` |
| skip_reason | enum | `ghosted`, `declined`, `out_of_scope`, `duplicate`, `other`. Required when stage = `skipped` |
| notes | text | Free-form, supports Markdown |
| last_stage_change_at | timestamptz | For stale detection |
| last_activity_at | timestamptz | Touched by any update or comment |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| created_by | uuid | FK → users.id |
| updated_by | uuid | FK → users.id |
| deleted_at | timestamptz | Soft delete. Auto-purge after 30 days (Pipeline trash) |

### Table: `discovery_call_stage_history`

Append-only audit log. One row per stage transition. Powers the timeline on the Edit modal and the activity feed on the Contact Detail page.

| Column | Type |
|---|---|
| id | uuid PK |
| discovery_call_id | uuid FK |
| from_stage | enum |
| to_stage | enum |
| changed_by | uuid FK → users.id |
| changed_at | timestamptz |
| reason | text |

### Table: `discovery_call_comments`

Internal team notes.

| Column | Type |
|---|---|
| id | uuid PK |
| discovery_call_id | uuid FK |
| author_id | uuid FK → users.id |
| body | text |
| mentions | uuid[] |
| created_at | timestamptz |
| updated_at | timestamptz |

### Table: `discovery_call_attachments`

Optional files (meeting notes, recordings, screenshots).

| Column | Type |
|---|---|
| id | uuid PK |
| discovery_call_id | uuid FK |
| file_url | text |
| file_name | text |
| mime_type | text |
| size_bytes | bigint |
| uploaded_by | uuid FK |
| uploaded_at | timestamptz |

### Table: `discovery_call_views`

User-saved filter presets surfaced as chips in the Filter panel.

| Column | Type |
|---|---|
| id | uuid PK |
| owner_id | uuid FK → users.id |
| name | text |
| filter_json | jsonb |
| is_shared | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

### Indexes

- `(owner_id, stage)` — power "My calls" view
- `(contact_id)` — lookup by contact
- `(stage, last_activity_at DESC)` — stale-card detection
- `(interview_date) WHERE stage = 'scheduled'` — upcoming calendar
- `(deleted_at) WHERE deleted_at IS NOT NULL` — Pipeline trash
- Unique partial: `(contact_id) WHERE stage NOT IN ('finished','skipped') AND deleted_at IS NULL` — prevents duplicate open calls per contact (or relax to UX-only check if too strict)

### Row-level security

- Members can read all discovery calls in their workspace
- Only the owner, the contact's assignee, or an admin can edit a card
- Only admins can reassign `owner_id` or hard delete

### Stale-card thresholds (fixed)

| Stage | Stale after |
|---|---|
| Replied Email/Whatsapp | 3 days without action |
| Waiting Reschedule | 5 days |
| Scheduled | interview_date + 1 day (without move) |
| Waiting Result | 7 days |
| Finished | n/a |
| Skipped | n/a |

---

## UX rules (Paper artboards)

### Add discovery call (Create)

- Modal opens with the Contact field empty and focused
- Contact picker = typeahead dropdown with three groups: **Recent**, **Suggestions** (replied via Email/WhatsApp in last 14 days, no open discovery call yet), **All matches**
- Each result row: avatar (tier-colored) · name · type chip (Twibbonize / External) · sub-line (tier · country · email or company)
- Contacts that already have an open discovery call show a "Has open call" warning chip and are deprioritized; clicking still allows linking but surfaces an inline warning ("This contact already has an open call in *Waiting Result* owned by *Rian S.* — Open existing / Continue anyway")
- "+ Create new contact" row at the bottom opens the Add Contact full-page flow with a breadcrumb back to the discovery call modal
- **Owner is locked** to the signed-in user. Displayed as a read-only chip with a lock icon and caption: "Set automatically. Admins can reassign from contact profile."
- "Add to pipeline" button stays disabled until a contact is selected and a stage chosen
- Stage defaults to **Replied Email/Whatsapp**; the footer shows "Card will appear in *{stage}*" as a live hint

### Edit discovery call (Update)

- Same form, pre-filled, including stage and all data fields
- Footer audit line: "Last updated {timeago} by {user}"
- Stage change is visible in `discovery_call_stage_history` and surfaces as a timeline entry on the Contact Detail page

### Card 3-dot menu

- Edit details · Move to stage (submenu of all 6 stages, current one badged "CURRENT") · Open contact · Copy card link · Delete card
- Drag-and-drop between columns is supported as an alternative to the menu

### Delete

- Confirmation modal with destructive icon, card preview, mandatory checkbox referencing the 30-day Pipeline trash recovery window
- Success toast at bottom with "Undo" affordance

### Filters

A right-side panel (380px) opens from the "Filters" button. Groups:

- **Saved views** — chip list of user-saved filter presets, + New
- **Owner** — chip list + "My calls only" toggle
- **Stage** — checkbox list of all 6 stages with per-stage counts; "Skipped" unchecked by default
- **Contact type** — Twibbonize / Non-Twibbonize
- **Tier** — Free / Premium Creator / Premium Supporter
- **Country** — multi-select dropdown
- **Interview date** — presets (This week / Next 7 days / This month / Custom)
- **Survey** — Not sent / Sent · pending / Completed / Skipped
- **Result** — Pending / Qualified / Nurture / Not qualified
- **Activity** — "Stale cards only" toggle with caption listing the per-stage thresholds
- **Lead source** — Email / WhatsApp / LinkedIn / Instagram

Footer: "Reset all" link, Cancel, "Apply · {count}" primary button.

Quick filter pills inline below the page title: All / My calls / Stale / This week / Needs reschedule — act as one-click presets layered on top of the panel filters.

Applied filters appear as removable chips in the row above the board (e.g. "Owner: Andar R.", "Tier: Premium Creator").
