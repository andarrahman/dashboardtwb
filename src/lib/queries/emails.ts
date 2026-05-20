/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/browser'
import type {
  EmailThreadRow,
  EmailMessageRow,
  EmailStatus,
  EmailAttachment,
  ContactEmailLogRow,
  UnifiedEmailRow,
} from '@/lib/supabase/types'

export type { EmailThreadRow, EmailMessageRow, EmailStatus, EmailAttachment, ContactEmailLogRow, UnifiedEmailRow }

// ─── Select fragments ─────────────────────────────────────────────────────────

const THREAD_SELECT = `
  *,
  contact:contacts (
    id, name, type, email, account_tier, country, company,
    business_category, segment, profile_url, whatsapp_number
  ),
  owner:profiles!email_threads_owner_id_fkey (
    id, display_name, email
  ),
  preview_messages:email_messages (
    body, body_html, direction, to_email, from_email
  )
`

const MESSAGE_SELECT = `*`

// ─── List threads ─────────────────────────────────────────────────────────────

export interface EmailFilters {
  status?: EmailStatus
  ownerIds?: string[]
  search?: string
  page?: number
  pageSize?: number
}

export async function getEmailThreads(
  workspaceId: string,
  filters: EmailFilters = {}
): Promise<{ data: EmailThreadRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = (supabase as any)
    .from('email_threads')
    .select(THREAD_SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.ownerIds?.length) {
    query = query.in('owner_id', filters.ownerIds)
  }
  if (filters.search) {
    query = query.or(
      `subject.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query

  if (error) return { data: [], total: 0, error: error.message }
  return {
    data: (data ?? []) as unknown as EmailThreadRow[],
    total: count ?? 0,
    error: null,
  }
}

// ─── Count by status ──────────────────────────────────────────────────────────

export async function getEmailCounts(
  workspaceId: string,
  ownerIds?: string[]
): Promise<{ all: number; sent: number; drafts: number; scheduled: number; replied: number; error: string | null }> {
  const supabase = createClient()

  let base = (supabase as any)
    .from('email_threads')
    .select('status', { count: 'exact', head: false })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (ownerIds?.length) {
    base = base.in('owner_id', ownerIds)
  }

  const { data, error } = await base

  if (error) return { all: 0, sent: 0, drafts: 0, scheduled: 0, replied: 0, error: error.message }

  const rows = (data ?? []) as { status: string }[]
  const count = (s: string) => rows.filter((r) => r.status === s).length

  return {
    all: rows.length,
    sent: count('sent'),
    drafts: count('draft'),
    scheduled: count('scheduled'),
    replied: count('replied'),
    error: null,
  }
}

// ─── Get single thread with messages ─────────────────────────────────────────

export async function getEmailThread(
  workspaceId: string,
  threadId: string
): Promise<{ thread: EmailThreadRow | null; messages: EmailMessageRow[]; error: string | null }> {
  const supabase = createClient()

  const [threadRes, messagesRes] = await Promise.all([
    (supabase as any)
      .from('email_threads')
      .select(THREAD_SELECT)
      .eq('id', threadId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .single(),
    (supabase as any)
      .from('email_messages')
      .select(MESSAGE_SELECT)
      .eq('thread_id', threadId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
  ])

  if (threadRes.error) return { thread: null, messages: [], error: threadRes.error.message }

  return {
    thread: threadRes.data as unknown as EmailThreadRow,
    messages: (messagesRes.data ?? []) as EmailMessageRow[],
    error: messagesRes.error?.message ?? null,
  }
}

// ─── Create draft thread ──────────────────────────────────────────────────────

export interface CreateEmailPayload {
  contact_id?: string | null
  subject?: string
  body?: string
  body_html?: string
  to_email?: string
  cc_emails?: string[]
  bcc_emails?: string[]
  attachments?: EmailAttachment[]
  ai_generated?: boolean
  ai_tone?: string
}

export async function createEmailDraft(
  workspaceId: string,
  userId: string,
  payload: CreateEmailPayload
): Promise<{ thread: EmailThreadRow | null; error: string | null }> {
  const supabase = createClient()

  // 1. Create thread
  const { data: thread, error: threadErr } = await (supabase as any)
    .from('email_threads')
    .insert({
      workspace_id: workspaceId,
      owner_id: userId,
      created_by: userId,
      contact_id: payload.contact_id ?? null,
      subject: payload.subject ?? '',
      status: 'draft',
      last_message_at: new Date().toISOString(),
      message_count: 1,
      ai_generated: payload.ai_generated ?? false,
      ai_tone: payload.ai_tone ?? null,
    })
    .select(THREAD_SELECT)
    .single()

  if (threadErr) return { thread: null, error: threadErr.message }

  // 2. Create initial draft message
  await (supabase as any).from('email_messages').insert({
    thread_id: thread.id,
    workspace_id: workspaceId,
    direction: 'outbound',
    to_email: payload.to_email ?? null,
    body: payload.body ?? null,
    body_html: payload.body_html ?? null,
    cc_emails: payload.cc_emails ?? [],
    bcc_emails: payload.bcc_emails ?? [],
    attachments: payload.attachments ?? [],
    created_by: userId,
  })

  return { thread: thread as unknown as EmailThreadRow, error: null }
}

// ─── Update thread (subject, status, scheduling) ─────────────────────────────

export interface UpdateEmailPayload {
  subject?: string
  status?: EmailStatus
  contact_id?: string | null
  owner_id?: string | null
  scheduled_at?: string | null
  ai_generated?: boolean
  ai_tone?: string | null
}

export async function updateEmailThread(
  workspaceId: string,
  threadId: string,
  payload: UpdateEmailPayload
): Promise<{ thread: EmailThreadRow | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await (supabase as any)
    .from('email_threads')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)
    .select(THREAD_SELECT)
    .single()

  if (error) return { thread: null, error: error.message }
  return { thread: data as unknown as EmailThreadRow, error: null }
}

// ─── Update draft message body ────────────────────────────────────────────────

export async function updateEmailMessage(
  messageId: string,
  payload: {
    body?: string
    body_html?: string
    to_email?: string
    cc_emails?: string[]
    bcc_emails?: string[]
    attachments?: EmailAttachment[]
  }
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('email_messages')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', messageId)

  return { error: error?.message ?? null }
}

// ─── Send email (mark thread + message as sent) ───────────────────────────────

export async function sendEmail(
  workspaceId: string,
  threadId: string,
  messageId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const [t, m] = await Promise.all([
    (supabase as any)
      .from('email_threads')
      .update({ status: 'sent', last_message_at: now, updated_at: now })
      .eq('id', threadId)
      .eq('workspace_id', workspaceId),
    (supabase as any)
      .from('email_messages')
      .update({ sent_at: now, updated_at: now })
      .eq('id', messageId),
  ])

  return { error: t.error?.message ?? m.error?.message ?? null }
}

// ─── Schedule email ───────────────────────────────────────────────────────────

export async function scheduleEmail(
  workspaceId: string,
  threadId: string,
  scheduledAt: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('email_threads')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

// ─── Add reply message (inbound or outbound) ──────────────────────────────────

export interface AddReplyPayload {
  direction: 'outbound' | 'inbound'
  from_email: string
  to_email: string
  body: string
  attachments?: EmailAttachment[]
}

export async function addEmailReply(
  workspaceId: string,
  threadId: string,
  userId: string,
  payload: AddReplyPayload
): Promise<{ message: EmailMessageRow | null; error: string | null }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const { data, error } = await (supabase as any)
    .from('email_messages')
    .insert({
      thread_id: threadId,
      workspace_id: workspaceId,
      direction: payload.direction,
      from_email: payload.from_email,
      to_email: payload.to_email,
      body: payload.body,
      attachments: payload.attachments ?? [],
      sent_at: now,
      created_by: userId,
    })
    .select(MESSAGE_SELECT)
    .single()

  if (error) return { message: null, error: error.message }

  // Update thread status and message count
  const newStatus = payload.direction === 'inbound' ? 'replied' : 'sent'
  await (supabase as any)
    .from('email_threads')
    .update({
      status: newStatus,
      last_message_at: now,
      updated_at: now,
    })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)

  // Count actual messages in DB to avoid read-then-write race condition
  const { count: msgCount } = await (supabase as any)
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
  await (supabase as any)
    .from('email_threads')
    .update({ message_count: msgCount ?? 1 })
    .eq('id', threadId)

  return { message: data as unknown as EmailMessageRow, error: null }
}

// ─── Mark thread read / unread ────────────────────────────────────────────────

export async function markThreadRead(
  workspaceId: string,
  threadId: string,
  isRead: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('email_threads')
    .update({ is_read: isRead })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)
  return { error: error?.message ?? null }
}

// ─── Delete draft (hard delete) ───────────────────────────────────────────────

export async function deleteEmailDraft(
  workspaceId: string,
  threadId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('email_threads')
    .delete()
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'draft')

  return { error: error?.message ?? null }
}

// ─── Remove sent email from CRM (soft delete) ─────────────────────────────────

export async function removeEmailFromCRM(
  workspaceId: string,
  threadId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('email_threads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)

  return { error: error?.message ?? null }
}

export async function deleteEmailLog(
  workspaceId: string,
  logId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('contact_email_logs')
    .delete()
    .eq('id', logId)
    .eq('workspace_id', workspaceId)
  return { error: error?.message ?? null }
}

// ─── Mark log email read / unread ─────────────────────────────────────────────

export async function markLogRead(
  workspaceId: string,
  logId: string,
  isRead: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('contact_email_logs')
    .update({ is_read: isRead })
    .eq('id', logId)
    .eq('workspace_id', workspaceId)
  return { error: error?.message ?? null }
}

// ─── Mark ALL unread emails as read ──────────────────────────────────────────

export async function markAllRead(
  workspaceId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const [t, l] = await Promise.all([
    (supabase as any)
      .from('email_threads')
      .update({ is_read: true })
      .eq('workspace_id', workspaceId)
      .eq('is_read', false),
    (supabase as any)
      .from('contact_email_logs')
      .update({ is_read: true })
      .eq('workspace_id', workspaceId)
      .eq('is_read', false)
      .eq('direction', 'inbound'),
  ])
  return { error: t.error?.message ?? l.error?.message ?? null }
}

// ─── Log outbound email to contact_email_logs ─────────────────────────────────
// Called after sending, so it appears in the contact activity timeline.

export async function logOutboundEmail(
  workspaceId: string,
  contactId: string,
  threadId: string,
  payload: {
    from_email: string
    from_name: string
    to_email: string
    subject: string
    body_preview?: string
  }
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('contact_email_logs')
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      thread_id: threadId,
      direction: 'outbound',
      from_email: payload.from_email,
      from_name: payload.from_name,
      to_email: payload.to_email,
      subject: payload.subject,
      body_preview: payload.body_preview ?? null,
      received_at: new Date().toISOString(),
    })

  return { error: error?.message ?? null }
}

// ─── Contact-scoped email log (for LogEmailDetail left panel) ────────────────
// Returns all contact_email_logs for a specific contact, newest first, paginated.

export async function getContactEmailLogs(
  workspaceId: string,
  contactId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: UnifiedEmailRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const page     = options.page     ?? 1
  const pageSize = options.pageSize ?? 10
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  const { data, error, count } = await (supabase as any)
    .from('contact_email_logs')
    .select(LOG_SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    // Exclude logs that are Gmail-sync duplicates of CRM threads (thread_id IS NOT NULL)
    .is('thread_id', null)
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) return { data: [], total: 0, error: error.message }

  const rows = (data ?? []) as ContactEmailLogRow[]
  const unified: UnifiedEmailRow[] = rows.map((l) => {
    const dir = (l.direction ?? 'inbound') as 'inbound' | 'outbound'
    return {
      id:               l.id,
      source:           'log' as const,
      workspace_id:     l.workspace_id,
      contact_id:       l.contact_id,
      contact:          l.contact ?? null,
      subject:          l.subject ?? '(no subject)',
      body_preview:     l.body_preview,
      direction:        dir,
      status:           dir === 'outbound' ? 'sent' as const : 'replied' as const,
      from_email:       l.from_email,
      to_email:         l.to_email,
      owner_id:         null,
      owner:            null,
      is_stale:         false,
      stale_since_days: null,
      scheduled_at:     null,
      last_message_at:  l.received_at,
      message_count:    1,
      log:              l,
    }
  })

  return { data: unified, total: count ?? 0, error: null }
}

// ─── Unified email list (threads + inbound logs) ─────────────────────────────
// Merges CRM-managed outbound threads with inbound emails from contact_email_logs.

const LOG_SELECT = `
  id, contact_id, workspace_id, from_email, from_name, to_email,
  subject, received_at, direction, body_preview, body_html, attachments, thread_id, is_read, created_at,
  contact:contacts (
    id, name, type, email, account_tier, country, company,
    business_category, segment, profile_url, whatsapp_number
  )
`

export async function getUnifiedEmails(
  workspaceId: string,
  filters: EmailFilters = {}
): Promise<{ data: UnifiedEmailRow[]; total: number; error: string | null }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20

  // Determine which sources to query based on tab filter
  const wantThreads = !filters.status || ['draft', 'sent', 'scheduled', 'replied'].includes(filters.status)
  // Show logs on: all, sent (outbound logs), replied (inbound logs). Not on draft/scheduled.
  const wantLogs = !filters.status || filters.status === 'replied' || filters.status === 'sent'

  const promises: Promise<unknown>[] = []

  // 1a. Outbound threads (owned by user, or all if no owner filter)
  if (wantThreads) {
    let q = (supabase as any)
      .from('email_threads')
      .select(THREAD_SELECT)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100)

    if (filters.status) q = q.eq('status', filters.status)
    if (filters.ownerIds?.length) q = q.in('owner_id', filters.ownerIds)
    if (filters.search) {
      const s = filters.search.replace(/'/g, "''")
      q = q.or(`subject.ilike.%${s}%,from_email.ilike.%${s}%`)
    }

    promises.push(q)
  } else {
    promises.push(Promise.resolve({ data: [] }))
  }

  // 2. All logs NOT linked to a CRM thread (both inbound & outbound from Gmail sync)
  //    thread_id IS NULL → not a duplicate of an email_thread entry
  if (wantLogs) {
    let q = (supabase as any)
      .from('contact_email_logs')
      .select(LOG_SELECT)
      .eq('workspace_id', workspaceId)
      .is('thread_id', null)
      .order('received_at', { ascending: false })
      .limit(100)

    // Narrow direction only when a specific status tab is active
    if (filters.status === 'replied') q = q.eq('direction', 'inbound')
    if (filters.status === 'sent')    q = q.eq('direction', 'outbound')

    if (filters.search) {
      const s = filters.search.replace(/'/g, "''")
      q = q.or(`subject.ilike.%${s}%,body_preview.ilike.%${s}%,from_email.ilike.%${s}%`)
    }

    promises.push(q)
  } else {
    promises.push(Promise.resolve({ data: [] }))
  }

  // 1b. Also fetch unread threads regardless of owner (inbound replies always surfaced)
  const unreadPromise: Promise<{ data: EmailThreadRow[] | null }> = wantThreads && filters.ownerIds?.length
    ? (supabase as any)
        .from('email_threads')
        .select(THREAD_SELECT)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .eq('is_read', false)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50)
    : Promise.resolve({ data: [] })

  const [threadsRes, logsRes, unreadRes] = await Promise.all([...promises, unreadPromise]) as [
    { data: EmailThreadRow[] | null; error?: { message: string } },
    { data: ContactEmailLogRow[] | null; error?: { message: string } },
    { data: EmailThreadRow[] | null }
  ]

  const err = threadsRes.error?.message ?? logsRes.error?.message ?? null

  // Merge owned threads + unread threads (deduplicate by ID)
  const seenThreadIds = new Set<string>()
  const mergedThreads: EmailThreadRow[] = []
  for (const t of [...(threadsRes.data ?? []), ...(unreadRes.data ?? [])]) {
    if (!seenThreadIds.has(t.id)) { seenThreadIds.add(t.id); mergedThreads.push(t) }
  }

  // Map threads → UnifiedEmailRow
  const fromThreads: UnifiedEmailRow[] = mergedThreads.map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previewMsgs: any[] = (t as any).preview_messages ?? []
    // Pick outbound message first for preview, fall back to any
    const previewMsg = previewMsgs.find((m: any) => m.direction === 'outbound') ?? previewMsgs[0]
    const rawBody: string = previewMsg?.body ?? previewMsg?.body_html?.replace(/<[^>]*>/g, '') ?? ''
    const bodyPreview = rawBody.slice(0, 200) || null
    const toEmail = previewMsgs.find((m: any) => m.direction === 'outbound')?.to_email ?? null
    return {
      id: t.id,
      source: 'thread' as const,
      workspace_id: t.workspace_id,
      contact_id: t.contact_id,
      contact: t.contact ?? null,
      subject: t.subject,
      body_preview: bodyPreview,
      direction: 'outbound' as const,
      status: t.status,
      from_email: null,
      to_email: toEmail,
      owner_id: t.owner_id,
      owner: t.owner ?? null,
      is_stale: t.is_stale,
      stale_since_days: t.stale_since_days,
      scheduled_at: t.scheduled_at,
      last_message_at: t.last_message_at,
      message_count: t.message_count,
      thread: t,
    }
  })

  // Map logs → UnifiedEmailRow (both inbound & outbound)
  const fromLogs: UnifiedEmailRow[] = (logsRes.data ?? []).map((l) => {
    const dir = (l.direction ?? 'inbound') as 'inbound' | 'outbound'
    return {
      id: l.id,
      source: 'log' as const,
      workspace_id: l.workspace_id,
      contact_id: l.contact_id,
      contact: l.contact ?? null,
      subject: l.subject ?? '(no subject)',
      body_preview: l.body_preview,
      direction: dir,
      status: dir === 'outbound' ? 'sent' as const : 'replied' as const,
      from_email: l.from_email,
      to_email: l.to_email,
      owner_id: null,
      owner: null,
      is_stale: false,
      stale_since_days: null,
      scheduled_at: null,
      last_message_at: l.received_at,
      message_count: 1,
      log: l,
    }
  })

  // Merge, sort by last_message_at desc, paginate
  const all = [...fromThreads, ...fromLogs]
    .sort((a, b) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    )
  const total = all.length
  const data = all.slice((page - 1) * pageSize, page * pageSize)

  return { data, total, error: err }
}

// ─── Unified counts (threads + inbound logs) ──────────────────────────────────

export async function getUnifiedEmailCounts(
  workspaceId: string,
  ownerIds?: string[]
): Promise<{ all: number; sent: number; drafts: number; scheduled: number; replied: number; unread: number; error: string | null }> {
  const supabase = createClient()

  let threadQ = (supabase as any)
    .from('email_threads')
    .select('status')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
  if (ownerIds?.length) threadQ = threadQ.in('owner_id', ownerIds)

  // Count non-CRM logs (thread_id IS NULL) split by direction
  const inboundLogQ = (supabase as any)
    .from('contact_email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'inbound')
    .is('thread_id', null)

  const outboundLogQ = (supabase as any)
    .from('contact_email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'outbound')
    .is('thread_id', null)

  // Count unread emails (unread threads + unread inbound logs)
  const unreadThreadQ = (supabase as any)
    .from('email_threads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .eq('is_read', false)

  const unreadLogQ = (supabase as any)
    .from('contact_email_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'inbound')
    .eq('is_read', false)
    .is('thread_id', null)

  const [threadRes, inboundLogRes, outboundLogRes, unreadThreadRes, unreadLogRes] = await Promise.all([
    threadQ, inboundLogQ, outboundLogQ, unreadThreadQ, unreadLogQ
  ])

  if (threadRes.error) {
    return { all: 0, sent: 0, drafts: 0, scheduled: 0, replied: 0, unread: 0, error: threadRes.error.message }
  }

  const rows = (threadRes.data ?? []) as { status: string }[]
  const cnt = (s: string) => rows.filter((r) => r.status === s).length
  const inboundLogCount  = inboundLogRes.count  ?? 0
  const outboundLogCount = outboundLogRes.count ?? 0
  const unreadCount      = (unreadThreadRes.count ?? 0) + (unreadLogRes.count ?? 0)

  return {
    all:       rows.length + inboundLogCount + outboundLogCount,
    sent:      cnt('sent') + outboundLogCount,
    drafts:    cnt('draft'),
    scheduled: cnt('scheduled'),
    replied:   cnt('replied') + inboundLogCount,
    unread:    unreadCount,
    error:     null,
  }
}
