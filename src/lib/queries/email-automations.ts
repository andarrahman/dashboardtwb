import { createClient } from '@/lib/supabase/browser'
import type {
  EmailAutomationRow,
  AutomationEnrollmentRow,
  AutomationLogRow,
  AutomationStatus,
  AutomationTriggerType,
  AutomationStep,
  AutomationTriggerConfig,
  AutomationEventType,
} from '@/lib/supabase/types'

// ─── List params ───────────────────────────────────────────────────────────────

export interface GetAutomationsParams {
  search?: string
  status?: AutomationStatus | 'all'
  trigger?: AutomationTriggerType | ''
  page?: number
  pageSize?: number
}

export interface AutomationCounts {
  all: number
  active: number
  paused: number
  draft: number
  archived: number
}

// ─── List ──────────────────────────────────────────────────────────────────────

export async function getEmailAutomations(
  workspaceId: string,
  params: GetAutomationsParams = {}
): Promise<{ automations: EmailAutomationRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { search, status, trigger, page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('email_automations')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (!status || status === 'all') {
    // show all non-deleted
  } else {
    query = query.eq('status', status)
  }

  if (trigger) {
    query = query.eq('trigger_type', trigger)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) return { automations: [], total: 0, error: error.message }
  return {
    automations: (data ?? []) as EmailAutomationRow[],
    total: count ?? 0,
    error: null,
  }
}

// ─── Tab counts ────────────────────────────────────────────────────────────────

export async function getAutomationCounts(
  workspaceId: string
): Promise<{ counts: AutomationCounts; error: string | null }> {
  const supabase = createClient()
  const counts: AutomationCounts = { all: 0, active: 0, paused: 0, draft: 0, archived: 0 }

  const run = async (extraFilter: (q: any) => any): Promise<number> => {
    const base = (supabase as any)
      .from('email_automations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    const { count, error } = await extraFilter(base)
    if (error) return 0
    return count ?? 0
  }

  const [all, active, paused, draft, archived] = await Promise.all([
    run((q: any) => q),
    run((q: any) => q.eq('status', 'active')),
    run((q: any) => q.eq('status', 'paused')),
    run((q: any) => q.eq('status', 'draft')),
    run((q: any) => q.eq('status', 'archived')),
  ])

  counts.all = all
  counts.active = active
  counts.paused = paused
  counts.draft = draft
  counts.archived = archived

  return { counts, error: null }
}

// ─── Single ────────────────────────────────────────────────────────────────────

export async function getEmailAutomation(
  workspaceId: string,
  id: string
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return { automation: null, error: error.message }
  return { automation: data as EmailAutomationRow, error: null }
}

// ─── Create ────────────────────────────────────────────────────────────────────

export interface CreateAutomationData {
  name?: string
  trigger_type?: AutomationTriggerType | null
  trigger_config?: AutomationTriggerConfig
  steps?: AutomationStep[]
  goal?: string | null
}

export async function createEmailAutomation(
  workspaceId: string,
  userId: string,
  userName: string,
  data: CreateAutomationData = {}
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .insert({
      workspace_id: workspaceId,
      name: data.name ?? 'Untitled workflow',
      status: 'draft',
      trigger_type: data.trigger_type ?? null,
      trigger_config: data.trigger_config ?? {},
      steps: data.steps ?? [],
      goal: data.goal ?? null,
      total_enrolled: 0,
      total_completed: 0,
      owner_id: userId,
      owner_name: userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
    })
    .select()
    .single()

  if (error) return { automation: null, error: error.message }
  return { automation: row as EmailAutomationRow, error: null }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export interface UpdateAutomationData {
  name?: string
  trigger_type?: AutomationTriggerType | null
  trigger_config?: AutomationTriggerConfig
  steps?: AutomationStep[]
  goal?: string | null
  status?: AutomationStatus
}

export async function updateEmailAutomation(
  workspaceId: string,
  id: string,
  userId: string,
  userName: string,
  data: UpdateAutomationData
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .update({
      ...data,
      updated_by: userId,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select()
    .single()

  if (error) return { automation: null, error: error.message }
  return { automation: row as EmailAutomationRow, error: null }
}

// ─── Delete (soft) ─────────────────────────────────────────────────────────────

export async function deleteEmailAutomation(
  workspaceId: string,
  id: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('email_automations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}

// ─── Publish ───────────────────────────────────────────────────────────────────

export async function publishEmailAutomation(
  workspaceId: string,
  id: string,
  userId: string,
  userName: string
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  return updateEmailAutomation(workspaceId, id, userId, userName, {
    status: 'active',
  })
}

// ─── Pause / Resume ────────────────────────────────────────────────────────────

export async function pauseEmailAutomation(
  workspaceId: string,
  id: string,
  userId: string,
  userName: string
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  const supabase = createClient()

  // First fetch current status to toggle
  const { data: current, error: fetchErr } = await (supabase as any)
    .from('email_automations')
    .select('status')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single()

  if (fetchErr || !current) return { automation: null, error: fetchErr?.message ?? 'Not found' }

  const newStatus: AutomationStatus = current.status === 'paused' ? 'active' : 'paused'
  const extra = newStatus === 'paused'
    ? { paused_at: new Date().toISOString() }
    : { paused_at: null }

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .update({
      status: newStatus,
      ...extra,
      updated_by: userId,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select()
    .single()

  if (error) return { automation: null, error: error.message }
  return { automation: row as EmailAutomationRow, error: null }
}

// ─── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateEmailAutomation(
  workspaceId: string,
  id: string,
  userId: string,
  userName: string
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  const supabase = createClient()

  const { data: original, error: fetchError } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return { automation: null, error: fetchError?.message ?? 'Automation not found' }
  }

  const src = original as EmailAutomationRow

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .insert({
      workspace_id: workspaceId,
      name: `${src.name} (copy)`,
      status: 'draft',
      trigger_type: src.trigger_type,
      trigger_config: src.trigger_config,
      steps: src.steps,
      goal: src.goal,
      total_enrolled: 0,
      total_completed: 0,
      owner_id: userId,
      owner_name: userName,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
    })
    .select()
    .single()

  if (error) return { automation: null, error: error.message }
  return { automation: row as EmailAutomationRow, error: null }
}

// ─── Archive ───────────────────────────────────────────────────────────────────

export async function archiveEmailAutomation(
  workspaceId: string,
  id: string,
  userId: string,
  userName: string
): Promise<{ automation: EmailAutomationRow | null; error: string | null }> {
  return updateEmailAutomation(workspaceId, id, userId, userName, { status: 'archived' })
}

// ─── Enrollments ───────────────────────────────────────────────────────────────

export interface GetEnrollmentsParams {
  status?: 'active' | 'completed' | 'exited' | 'error' | ''
  step_index?: number | null
  page?: number
  pageSize?: number
}

export async function getAutomationEnrollments(
  workspaceId: string,
  automationId: string,
  params: GetEnrollmentsParams = {}
): Promise<{ enrollments: AutomationEnrollmentRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { status, step_index, page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('automation_enrollments')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('automation_id', automationId)
    .order('enrolled_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (step_index != null) query = query.eq('current_step_index', step_index)

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) return { enrollments: [], total: 0, error: error.message }

  // Fetch contact details for each enrollment
  const rows = (data ?? []) as AutomationEnrollmentRow[]
  const contactIds = [...new Set(rows.map((r) => r.contact_id))]

  if (contactIds.length > 0) {
    const { data: contacts } = await (supabase as any)
      .from('contacts')
      .select('id, name, email, avatar_url')
      .in('id', contactIds)

    if (contacts) {
      const contactMap = new Map(contacts.map((c: { id: string }) => [c.id, c]))
      rows.forEach((r) => {
        r.contact = contactMap.get(r.contact_id) as AutomationEnrollmentRow['contact']
      })
    }
  }

  return { enrollments: rows, total: count ?? 0, error: null }
}

// ─── Logs ──────────────────────────────────────────────────────────────────────

export interface GetLogsParams {
  event_type?: AutomationEventType | ''
  page?: number
  pageSize?: number
}

export async function getAutomationLogs(
  workspaceId: string,
  automationId: string,
  params: GetLogsParams = {}
): Promise<{ logs: AutomationLogRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const { event_type, page = 1, pageSize = 50 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('automation_logs')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('automation_id', automationId)
    .order('created_at', { ascending: false })

  if (event_type) query = query.eq('event_type', event_type)

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) return { logs: [], total: 0, error: error.message }

  const rows = (data ?? []) as AutomationLogRow[]
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))]

  if (contactIds.length > 0) {
    const { data: contacts } = await (supabase as any)
      .from('contacts')
      .select('id, name, email, avatar_url')
      .in('id', contactIds)

    if (contacts) {
      const contactMap = new Map(contacts.map((c: { id: string }) => [c.id, c]))
      rows.forEach((r) => {
        if (r.contact_id) {
          r.contact = contactMap.get(r.contact_id) as AutomationLogRow['contact']
        }
      })
    }
  }

  return { logs: rows, total: count ?? 0, error: null }
}

export interface AddLogData {
  contact_id?: string | null
  event_type: AutomationEventType
  event_label: string
  description?: string | null
  metadata?: Record<string, unknown>
}

export async function addAutomationLog(
  workspaceId: string,
  automationId: string,
  data: AddLogData
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('automation_logs')
    .insert({
      automation_id: automationId,
      workspace_id: workspaceId,
      contact_id: data.contact_id ?? null,
      event_type: data.event_type,
      event_label: data.event_label,
      description: data.description ?? null,
      metadata: data.metadata ?? {},
    })

  if (error) return { error: error.message }
  return { error: null }
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export interface AutomationStats {
  total_enrolled: number
  total_completed: number
  total_active: number
  total_exited: number
  avg_open_rate: number | null
  avg_click_rate: number | null
  completion_rate: number | null
}

export async function getAutomationStats(
  workspaceId: string,
  automationId: string
): Promise<{ stats: AutomationStats | null; error: string | null }> {
  const supabase = createClient()

  // Get enrollment counts by status
  const { data: enrollData, error: enrollErr } = await (supabase as any)
    .from('automation_enrollments')
    .select('status')
    .eq('workspace_id', workspaceId)
    .eq('automation_id', automationId)

  if (enrollErr) return { stats: null, error: enrollErr.message }

  const rows = (enrollData ?? []) as Array<{ status: string }>
  const total_enrolled = rows.length
  const total_completed = rows.filter((r) => r.status === 'completed').length
  const total_active = rows.filter((r) => r.status === 'active').length
  const total_exited = rows.filter((r) => r.status === 'exited').length

  // Get automation row for open/click rates
  const { data: autoRow, error: autoErr } = await (supabase as any)
    .from('email_automations')
    .select('avg_open_rate, avg_click_rate')
    .eq('id', automationId)
    .single()

  if (autoErr) return { stats: null, error: autoErr.message }

  const auto = autoRow as { avg_open_rate: number | null; avg_click_rate: number | null }

  const completion_rate = total_enrolled > 0
    ? Math.round((total_completed / total_enrolled) * 100)
    : null

  return {
    stats: {
      total_enrolled,
      total_completed,
      total_active,
      total_exited,
      avg_open_rate: auto.avg_open_rate,
      avg_click_rate: auto.avg_click_rate,
      completion_rate,
    },
    error: null,
  }
}
