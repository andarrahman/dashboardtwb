# Discovery Call · User Stories & Use Cases

Belongs to **Epic 3 · Outreach Creator → Discovery Call** sub-module. Covers the full lifecycle from the moment a prospect replies until the conversation reaches a result (Qualified / Nurture / Not qualified / Skipped).

---

## Personas

| Persona | Role | What they care about |
|---|---|---|
| **SDR (Sales Development Rep)** | Owns their personal pipeline of leads | Speed of triage, knowing what to act on today, avoiding lost leads |
| **Partnership Manager (PM)** | Receives qualified leads from SDRs | Visibility into incoming hand-offs, context on why a lead was qualified |
| **Marketing (MKT)** | Sources leads from campaigns | Sees which lead sources convert, can audit responses |
| **Workspace Admin** | Manages the team's pipeline overall | Reassigning owners, tuning stale thresholds, deleting cards |

The primary user is the **SDR**. Other personas read or take downstream actions.

---

## Pipeline overview

Six ordered stages on a Kanban:

1. **Replied Email/Whatsapp** — Prospect just replied. Card lands here on creation.
2. **Waiting Reschedule** — Interview was missed or postponed; new slot pending.
3. **Scheduled** — Interview on the calendar with date + time.
4. **Waiting Result** — Interview happened. Awaiting survey completion or stakeholder review.
5. **Finished** — Decision made. Result is Qualified, Nurture, or Not qualified.
6. **Skipped** — Prospect dropped without resolution. Has a `skip_reason`.

---

## User Stories

### Pipeline visibility

**US-DC-01 · View pipeline as Kanban**
*As an* SDR, *I want* to see all my discovery calls grouped by stage *so that* I can scan what's where at a glance.

**US-DC-02 · Switch between personal and team view**
*As an* SDR, *I want* to toggle between "My calls" and "Team view" *so that* I can either focus on my own work or check the whole team's pipeline.

**US-DC-03 · Filter the pipeline**
*As an* SDR, *I want* to filter cards by owner, stage, contact type, tier, country, interview date range, survey status, result, and lead source *so that* I can focus on relevant subsets.

**US-DC-04 · Search inside the pipeline**
*As an* SDR, *I want* to type-search by contact name, company, or note content *so that* I can jump to a card quickly.

**US-DC-05 · See which cards need action**
*As an* SDR, *I want* stale cards to be visually marked *so that* I know what's overdue. Stale rules: Replied > 3d, Waiting Reschedule > 5d, Scheduled with past interview date, Waiting Result > 7d.

### Adding a discovery call

**US-DC-06 · Add a discovery call manually**
*As an* SDR, *I want* to add a new discovery call from a "+ Add manually" button *so that* I can record a reply that came in outside the integrated channels.

**US-DC-07 · Pick a contact via typeahead search**
*As an* SDR, *I want* to search contacts by typing and select from results *so that* I don't have to remember exact spelling.

**US-DC-08 · Create a new contact in-flow**
*As an* SDR, *I want* a "Create new contact" option in the search dropdown *so that* I'm not blocked when the prospect isn't in the CRM yet.

**US-DC-09 · See a warning for contacts with open calls**
*As an* SDR, *I want* to be warned if the contact already has an open discovery call *so that* I don't create duplicates.

**US-DC-10 · Have owner set automatically**
*As an* SDR, *I want* the owner field to be locked to me when I create a card *so that* accountability is clear and I can't pick a teammate by accident.

**US-DC-11 · See validation errors before save**
*As an* SDR, *I want* clear inline errors when I miss a required field *so that* I know exactly what to fix.

### Editing and managing a card

**US-DC-12 · Edit card details**
*As an* SDR, *I want* to edit a card's contact, interview, survey, result, lead source, and notes *so that* I can keep the record accurate.

**US-DC-13 · Change the contact on an existing card**
*As an* SDR, *I want* to swap the contact while keeping the rest of the call data *so that* I can fix a wrong contact assignment without re-entering everything.

**US-DC-14 · Move a card via 3-dot menu**
*As an* SDR, *I want* a "Move to stage" option on every card *so that* I can change stage without dragging.

**US-DC-15 · Drag a card between columns**
*As an* SDR, *I want* to drag cards from column to column *so that* moving feels natural.

**US-DC-16 · Open the linked contact**
*As an* SDR, *I want* to open the contact's full profile from the card menu *so that* I can see their history outside this call.

**US-DC-17 · Soft-delete a card**
*As an* SDR, *I want* to delete a card with a 30-day undo window *so that* I can recover from mistakes.

### Stage transitions with required input

**US-DC-18 · Reschedule with a reason**
*As an* SDR, *when* I move a card to Waiting Reschedule, *I want* to pick a reason (No-show / Postponed by us / Postponed by them / Other) and add a note *so that* the team understands the context.

**US-DC-19 · Skip with a reason**
*As an* SDR, *when* I move a card to Skipped, *I want* to pick a reason (Ghosted / Declined / Out of scope / Duplicate / Other) and optionally add a note *so that* the team understands why the lead dropped.

**US-DC-20 · Finish with result + next action**
*As an* SDR, *when* I move a card to Finished, *I want* to pick a result (Qualified / Nurture / Not qualified) and a next action (Send to Partnership / Nurture 90d / Archive) *so that* the hand-off path is explicit.

**US-DC-21 · Reopen a Skipped card**
*As an* SDR, *I want* a "Reopen → Replied" action on Skipped cards *so that* I can bring a lead back if circumstances change.

### Sub-data and history

**US-DC-22 · Capture the lead source**
*As an* MKT manager, *I want* every card to be tagged with how the prospect reached out (Email / WhatsApp / LinkedIn / Instagram) *so that* I can analyze conversion by channel.

**US-DC-23 · See lead source on each card**
*As an* SDR, *I want* a small icon on the card showing the lead source *so that* I can identify the channel without opening the card.

**US-DC-24 · See stage history on a card**
*As a* PM, *I want* a timeline of stage transitions on the card *so that* I can understand how the conversation evolved.

**US-DC-25 · Comment on a card**
*As an* SDR, *I want* to leave internal comments and @mention teammates *so that* I can discuss the lead without leaving the CRM.

**US-DC-26 · Attach files**
*As an* SDR, *I want* to attach meeting notes or recordings *so that* the team has supporting context.

### Operations and admin

**US-DC-27 · Reassign the owner (admin)**
*As an* admin, *I want* to reassign the owner of a card *so that* I can rebalance workload or cover for absent reps.

**US-DC-28 · Hard-delete a card (admin)**
*As an* admin, *I want* to permanently delete a card from the Pipeline trash *so that* I can clear sensitive data on request.

### Empty and loading states

**US-DC-29 · See guidance when there are no cards**
*As a* first-time SDR, *I want* a friendly empty state explaining the pipeline and a primary CTA to add my first call *so that* I know where to start.

**US-DC-30 · See guidance per empty column**
*As an* SDR, *I want* each empty column to explain what belongs there and offer a "+ Add manually" shortcut *so that* I can populate it directly.

**US-DC-31 · See a loading skeleton on first paint**
*As an* SDR, *I want* a skeleton layout while the board loads *so that* the page feels fast and I know data is coming.

---

## Use Cases

Steps are written as: **Actor → System** lines. **Preconditions** and **Postconditions** define entry/exit state.

### UC-DC-01 · Open the Discovery Call pipeline

**Actor:** SDR  
**Precondition:** User is authenticated and a member of the workspace.  
**Trigger:** User clicks `Outreach Creator → Discovery Call` in the sidebar.

1. System loads the page chrome and renders the loading skeleton.
2. System fetches all non-deleted cards in the workspace where `owner_id = current user` (default "My calls") and groups them by stage.
3. System renders 6 columns with cards.
4. If there are zero cards, system shows the full-page empty state (UC-DC-15).

**Postcondition:** User sees the pipeline.

---

### UC-DC-02 · Add a discovery call (happy path)

**Actor:** SDR  
**Precondition:** Pipeline is open.  
**Trigger:** User clicks `+ Add manually` in the page header.

1. System opens the Add discovery call modal with the Contact field focused and empty.
2. User types a name in the Contact search.
3. System shows matching contacts (with their segment, country, email) and a "Create new contact" fallback row.
4. User picks a contact.
5. Modal collapses the search into a filled contact card. Footer hint reads "Card will appear in *Replied Email/Whatsapp*".
6. User picks a Lead source chip (Email / WhatsApp / LinkedIn / Instagram).
7. User optionally sets the interview date/time, survey status, result, and notes.
8. User clicks **Add to pipeline**.
9. System inserts a row in `discovery_calls` with `owner_id = auth.uid()`, `stage = replied`, and logs the insert in `discovery_call_stage_history`.
10. Modal closes, the new card appears in the Replied Email/Whatsapp column, and a success toast appears with "View card".

**Postcondition:** Card exists in the workspace pipeline.

**Alt 4a — Contact has open call:** the row shows a "Has open call" badge. If picked, an inline warning surfaces with "Open existing / Continue anyway".  
**Alt 4b — Create new contact:** user clicks the create row → navigates to Add Contact flow → returns to the modal with the new contact pre-filled.

---

### UC-DC-03 · Add card — validation error

**Actor:** SDR  
**Trigger:** User clicks **Add to pipeline** without filling all required fields.

1. System highlights Contact, Stage, and Lead source with red error borders.
2. System shows a red banner: "3 fields need attention" with a "Jump to first" pill.
3. The submit button is disabled and the footer reads "3 required fields missing".

**Postcondition:** No row written. User remains in the modal.

---

### UC-DC-04 · Change the contact on a new card

**Actor:** SDR  
**Precondition:** Add modal is open with a contact already selected.  
**Trigger:** User clicks **Change** on the contact card.

1. System replaces the filled card with the active search input, pre-focused.
2. A small "Changing contact" pill appears, and helper text reassures "Other call data will be kept".
3. The dropdown opens with two groups: "Currently selected" (the previous contact with a "Keep" pill) and matches for the typed query.
4. User picks a different contact OR presses **Esc** / clicks **Keep** to revert.

**Postcondition:** Contact is swapped or unchanged. Other form fields are preserved.

---

### UC-DC-05 · Edit an existing discovery call

**Actor:** SDR  
**Precondition:** Pipeline is open.  
**Trigger:** User clicks a card OR picks "Edit details" from the 3-dot menu.

1. System opens the Edit modal with all fields pre-filled.
2. User edits any field except owner (locked unless they are admin).
3. User clicks **Save changes**.
4. System updates the row and refreshes `last_activity_at`.
5. Modal closes; success toast "Changes saved · Undo".

**Postcondition:** Updated values persisted.

---

### UC-DC-06 · Move a card via 3-dot menu

**Actor:** SDR  
**Trigger:** User clicks the 3-dot icon on a card → hovers **Move to stage** → picks a stage.

1. System shows the action menu, with the Move submenu listing the 6 stages.
2. Current stage shows a "CURRENT" badge.
3. User picks the destination stage.
4. If the destination is Waiting Reschedule / Skipped / Finished, system opens the matching reason prompt (UC-DC-09 / UC-DC-10 / UC-DC-11).
5. Otherwise, system updates `stage`, logs to `discovery_call_stage_history`, and the card animates to the new column.

**Postcondition:** Card is in the new column. Toast "Moved to *Stage* · Undo".

---

### UC-DC-07 · Drag a card between columns

**Actor:** SDR  
**Trigger:** User drags a card from one column and drops it on another.

1. System shows a ghost slot in the source column and highlights the destination column as a drop zone.
2. On drop, system applies the same logic as UC-DC-06 (with possible reason prompts).

**Postcondition:** Same as UC-DC-06.

**Alt 2a — Drop on the same column:** no change, ghost is removed.

---

### UC-DC-08 · Move card to Scheduled

**Actor:** SDR  
**Trigger:** Card moved to Scheduled via menu, drag, or Edit modal.

1. If `interview_date` is empty, system opens a small date/time picker inline.
2. User sets `interview_date` and `interview_time`.
3. System sets `stage = scheduled`, logs to history.

**Postcondition:** Card in Scheduled with an interview date set.

---

### UC-DC-09 · Move card to Waiting Reschedule

**Actor:** SDR  
**Trigger:** Card moved to Waiting Reschedule.

1. System opens the Reschedule reason prompt.
2. User picks one of `no_show`, `postponed_by_us`, `postponed_by_them`, `other`.
3. User optionally adds a note.
4. User clicks **Move to Reschedule**.
5. System sets `stage = waiting_reschedule`, `reschedule_reason`, `reschedule_note`, increments `reschedule_count`, and logs to history.

**Postcondition:** Card is in Waiting Reschedule with audit context.

**Alt 4a — User cancels:** card returns to its previous stage.

---

### UC-DC-10 · Skip a card

**Actor:** SDR  
**Trigger:** Card moved to Skipped (via menu, drag, or Delete card → "skip instead" choice).

1. System opens the Skip reason prompt.
2. User picks one of `ghosted`, `declined`, `out_of_scope`, `duplicate`, `other`.
3. User optionally adds a note.
4. User clicks **Move to Skipped**.
5. System sets `stage = skipped`, `skip_reason`, `skip_note`, and logs to history.

**Postcondition:** Card is in Skipped column. Toast "Skipped · *reason* · Undo".

**Alt — Reopen later:** see UC-DC-12.

---

### UC-DC-11 · Finish a card with result + next action

**Actor:** SDR  
**Trigger:** Card moved from Waiting Result to Finished.

1. System opens the Set Result prompt.
2. User picks a Result chip: `qualified`, `nurture`, or `not_qualified`.
3. User picks a Next action: `to_partnership`, `nurture_90d`, `archive`.
4. User clicks **Finish & hand off**.
5. System sets `stage = finished`, `result`, `next_action`, `result_decided_at`, `result_decided_by`, and logs to history.
6. If `next_action = to_partnership`, system creates a Partnership pipeline entry (E4) and notifies the Partnership team.
7. If `next_action = nurture_90d`, system creates a reminder 90 days out.

**Postcondition:** Card in Finished with downstream effects triggered. Toast describes the result and the hand-off destination.

---

### UC-DC-12 · Reopen a Skipped card

**Actor:** SDR  
**Trigger:** User clicks **Reopen → Replied** on a Skipped card.

1. System sets `stage = replied`, clears `skip_reason` and `skip_note`, logs to history with reason "Reopened".

**Postcondition:** Card is back in Replied Email/Whatsapp.

---

### UC-DC-13 · Delete a card

**Actor:** SDR  
**Trigger:** User picks **Delete card** from the 3-dot menu.

1. System opens the delete confirmation dialog with a card preview.
2. User must check the 30-day-trash acknowledgment.
3. User clicks **Remove from pipeline**.
4. System sets `deleted_at = now()` (soft delete).
5. Card disappears from the board. Toast "Discovery call removed · Undo" with a 30-day Pipeline trash mention.

**Postcondition:** Card hidden from pipeline; recoverable for 30 days; auto-purged after.

---

### UC-DC-14 · Filter the pipeline

**Actor:** SDR  
**Trigger:** User clicks the **Filters** button.

1. System opens a right-side panel (380 px).
2. User toggles "My calls only", stage checkboxes, contact type, tier, interview date range, survey status, result, and lead source.
3. Live count shows how many cards match.
4. User clicks **Apply · N** (or "Reset all").
5. System applies filter chips visible above the board; columns re-render with the filtered set.

**Postcondition:** Pipeline shows only matching cards.

---

### UC-DC-15 · See full-page empty state

**Actor:** First-time SDR  
**Precondition:** Workspace has zero non-deleted discovery calls.

1. System renders the page chrome (sidebar + breadcrumb) but skips the filter chips row and search.
2. Main area shows the illustration, headline "No discovery calls yet", explainer, primary "Add discovery call" CTA, secondary "Read the playbook", and "Quick start" hint card.

**Postcondition:** User can start the Add flow from the CTA.

---

### UC-DC-16 · See empty column state

**Actor:** SDR  
**Precondition:** Pipeline has data overall but at least one column has zero cards.

1. The empty column shows a dashed-bordered inner box with a stage-appropriate icon, one-line description, and a "+ Add manually" pill.

**Postcondition:** User can add directly into that column from the pill.

---

### UC-DC-17 · Reassign owner (admin)

**Actor:** Admin  
**Trigger:** Admin opens a card menu → **Reassign owner** (admin-only).

1. System shows a teammate picker.
2. Admin selects the new owner.
3. System updates `owner_id`, logs to activity, notifies the new owner.

**Postcondition:** Ownership transferred.

---

## Acceptance criteria summary

A feature ships when all of the following are true:

- All 6 stages are present in the order: Replied → Waiting Reschedule → Scheduled → Waiting Result → Finished → Skipped.
- Owner is always set to `auth.uid()` on create and is read-only in the Add/Edit modals; only admins can reassign.
- `lead_source` is required at create-time and enforced by both UI validation and DB NOT NULL.
- Moving a card to Waiting Reschedule, Skipped, or Finished cannot bypass the matching reason prompt.
- Every stage transition writes a row to `discovery_call_stage_history`.
- A 30-day soft-delete window is honored; cards in trash are recoverable by the same user or any admin and auto-purge after 30 days.
- Empty states exist for: full-board empty, per-column empty, and search no-results.
- Toasts exist for Add, Update, Move, Finish, Skip, and Delete with an Undo affordance (where applicable).
- Filter applies live; filter chips are visible and removable above the board.
- RLS prevents users from reading or editing discovery calls outside their workspace.

---

## Out of scope (v1)

- Calendar view alternative to the Kanban
- Bulk actions / multi-select
- Mobile / responsive layout
- Native scheduling integration with Google Calendar / Outlook
- Inline survey builder (uses external survey link only)
- AI summarization of call notes
