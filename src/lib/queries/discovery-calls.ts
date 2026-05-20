/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/browser'
import type {
  DiscoveryCallRow,
  DiscoveryCallStage,
  DiscoveryCallLeadSource,
  DiscoveryCallSurveyStatus,
  DiscoveryCallResult,
  DiscoveryCallNextAction,
  DiscoveryCallSkipReason,
  DiscoveryCallRescheduleReason,
  DiscoveryCallStageHistoryRow,
} from '@/lib/supabase/types'

export type {
  DiscoveryCallRow,
  DiscoveryCallStage,
  DiscoveryCallLeadSource,
  DiscoveryCallSurveyStatus,
  DiscoveryCallResult,
  DiscoveryCallNextAction,
  DiscoveryCallSkipReason,
  DiscoveryCallRescheduleReason,
  DiscoveryCallStageHistoryRow,
}

// ─── Contact select (with join) ───────────────────────────────────────────────

const DC_SELECT = `
  *,
  contact:contacts (
    id, name, type, email, account_tier, country, company,
    business_category, segment, profile_url
  ),
  owner:profiles!discovery_calls_owner_profiles_fkey (
    id, display_name, email
  )
`

// ─── Fetch all calls for a workspace ─────────────────────────────────────────

export interface DiscoveryCallFilters {
  myCallsOnly?: boolean
  ownerId?: string
  stages?: DiscoveryCallStage[]
  leadSources?: DiscoveryCallLeadSource[]
  surveyStatuses?: DiscoveryCallSurveyStatus[]
  results?: DiscoveryCallResult[]
  search?: string
}

export async function getDiscoveryCalls(
  workspaceId: string,
  filters: DiscoveryCallFilters = {}
): Promise<{ data: DiscoveryCallRow[]; error: string | null }> {
  const supabase = createClient()

  let query = (supabase as any)
    .from('discovery_calls')
    .select(DC_SELECT)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('last_activity_at', { ascending: false })

  if (filters.myCallsOnly && filters.ownerId) {
    query = query.eq('owner_id', filters.ownerId)
  }
  if (filters.stages?.length) {
    query = query.in('stage', filters.stages)
  }
  if (filters.leadSources?.length) {
    query = query.in('lead_source', filters.leadSources)
  }
  if (filters.surveyStatuses?.length) {
    query = query.in('survey_status', filters.surveyStatuses)
  }
  if (filters.results?.length) {
    query = query.in('result', filters.results)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as unknown as DiscoveryCallRow[], error: null }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateDiscoveryCallPayload {
  contact_id: string
  stage?: DiscoveryCallStage
  lead_source: DiscoveryCallLeadSource
  interview_date?: string | null
  interview_time?: string | null
  interview_meeting_url?: string | null
  interview_document_url?: string | null
  survey_status?: DiscoveryCallSurveyStatus
  result?: DiscoveryCallResult
  notes?: string | null
}

export async function createDiscoveryCall(
  workspaceId: string,
  userId: string,
  payload: CreateDiscoveryCallPayload
): Promise<{ data: DiscoveryCallRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('discovery_calls')
    .insert({
      workspace_id: workspaceId,
      owner_id: userId,
      created_by: userId,
      stage: payload.stage ?? 'replied',
      lead_source: payload.lead_source,
      contact_id: payload.contact_id,
      interview_date: payload.interview_date ?? null,
      interview_time: payload.interview_time ?? null,
      interview_meeting_url: payload.interview_meeting_url ?? null,
      interview_document_url: payload.interview_document_url ?? null,
      survey_status: payload.survey_status ?? 'not_sent',
      result: payload.result ?? 'pending',
      notes: payload.notes ?? null,
    })
    .select(DC_SELECT)
    .single()

  if (error) return { data: null, error: error.message }

  // Log initial stage history
  if (data) {
    await (supabase as any).from('discovery_call_stage_history').insert({
      discovery_call_id: data.id,
      from_stage: null,
      to_stage: data.stage,
      changed_by: userId,
      reason: 'Created',
    })
  }

  return { data: data as unknown as DiscoveryCallRow, error: null }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateDiscoveryCallPayload {
  contact_id?: string
  lead_source?: DiscoveryCallLeadSource
  interview_date?: string | null
  interview_time?: string | null
  interview_meeting_url?: string | null
  interview_document_url?: string | null
  survey_status?: DiscoveryCallSurveyStatus
  result?: DiscoveryCallResult
  notes?: string | null
  owner_id?: string
}

export async function updateDiscoveryCall(
  workspaceId: string,
  id: string,
  userId: string,
  payload: UpdateDiscoveryCallPayload
): Promise<{ data: DiscoveryCallRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('discovery_calls')
    .update({ ...payload, updated_by: userId })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(DC_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as DiscoveryCallRow, error: null }
}

// ─── Move stage ───────────────────────────────────────────────────────────────

export interface MoveStagePayload {
  to_stage: DiscoveryCallStage
  // Waiting Reschedule
  reschedule_reason?: DiscoveryCallRescheduleReason
  reschedule_note?: string
  // Skipped
  skip_reason?: DiscoveryCallSkipReason
  skip_note?: string
  // Finished
  result?: DiscoveryCallResult
  next_action?: DiscoveryCallNextAction
  result_decided_by?: string
}

export async function moveDiscoveryCallStage(
  workspaceId: string,
  id: string,
  userId: string,
  fromStage: DiscoveryCallStage,
  payload: MoveStagePayload
): Promise<{ data: DiscoveryCallRow | null; error: string | null }> {
  const supabase = createClient()

  const update: Record<string, unknown> = {
    stage: payload.to_stage,
    last_stage_change_at: new Date().toISOString(),
    updated_by: userId,
  }

  if (payload.to_stage === 'waiting_reschedule') {
    update.reschedule_reason = payload.reschedule_reason
    update.reschedule_note = payload.reschedule_note ?? null
    update.reschedule_count = supabase.rpc as unknown // incremented via SQL
  }
  if (payload.to_stage === 'skipped') {
    update.skip_reason = payload.skip_reason
    update.skip_note = payload.skip_note ?? null
  }
  if (payload.to_stage === 'finished') {
    update.result = payload.result
    update.next_action = payload.next_action
    update.result_decided_at = new Date().toISOString()
    update.result_decided_by = payload.result_decided_by ?? userId
  }
  if (payload.to_stage === 'replied') {
    // Reopen from skipped
    update.skip_reason = null
    update.skip_note = null
  }

  const { data, error } = await (supabase as any)
    .from('discovery_calls')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(DC_SELECT)
    .single()

  if (error) return { data: null, error: error.message }

  // Increment reschedule_count via separate update
  if (payload.to_stage === 'waiting_reschedule' && data) {
    await (supabase as any)
      .from('discovery_calls')
      .update({ reschedule_count: (data as unknown as DiscoveryCallRow).reschedule_count + 1 })
      .eq('id', id)
  }

  // Log stage history
  if (data) {
    const reasonText =
      payload.reschedule_note ?? payload.skip_note ??
      (payload.result ? `Result: ${payload.result}` : undefined)

    await (supabase as any).from('discovery_call_stage_history').insert({
      discovery_call_id: id,
      from_stage: fromStage,
      to_stage: payload.to_stage,
      changed_by: userId,
      reason: reasonText ?? null,
    })
  }

  return { data: data as unknown as DiscoveryCallRow, error: null }
}

// ─── Soft delete ──────────────────────────────────────────────────────────────

export async function deleteDiscoveryCall(
  workspaceId: string,
  id: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('discovery_calls')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ─── Restore (undo delete) ────────────────────────────────────────────────────

export async function restoreDiscoveryCall(
  workspaceId: string,
  id: string,
  userId: string
): Promise<{ data: DiscoveryCallRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('discovery_calls')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(DC_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as DiscoveryCallRow, error: null }
}

// ─── Check for open call on a contact ────────────────────────────────────────

export async function getOpenCallForContact(
  workspaceId: string,
  contactId: string
): Promise<{ data: DiscoveryCallRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('discovery_calls')
    .select(DC_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .not('stage', 'in', '(finished,skipped)')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as DiscoveryCallRow | null, error: null }
}

// ─── Stage history for a call ─────────────────────────────────────────────────

export async function getDiscoveryCallHistory(
  callId: string
): Promise<{ data: DiscoveryCallStageHistoryRow[]; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('discovery_call_stage_history')
    .select('*')
    .eq('discovery_call_id', callId)
    .order('changed_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: data as DiscoveryCallStageHistoryRow[], error: null }
}
