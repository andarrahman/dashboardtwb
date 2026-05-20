import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeQuarter(dueDateStr: string): string {
  const d = new Date(dueDateStr)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

/**
 * Allocate the next project code for a workspace (PRJ-001, PRJ-002 …).
 * Uses a simple upsert-on-conflict pattern on the project_code_sequences helper table.
 */
async function nextProjectCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<string> {
  // Upsert to ensure the row exists, then fetch-and-increment via rpc or select
  // We use a manual fetch + update approach (safe with Supabase Row-level locking)
  const { data: seq, error: seqErr } = await (supabase as any)
    .from('project_code_sequences')
    .upsert({ workspace_id: workspaceId, next_val: 1 }, { onConflict: 'workspace_id', ignoreDuplicates: false })
    .select('next_val')
    .single()

  if (seqErr && seqErr.code !== '23505') {
    // fallback: just count existing projects for this workspace
    const { count } = await (supabase as any)
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    const n = (count ?? 0) + 1
    return `PRJ-${String(n).padStart(3, '0')}`
  }

  const currentVal: number = seq?.next_val ?? 1

  // Increment the sequence
  await (supabase as any)
    .from('project_code_sequences')
    .update({ next_val: currentVal + 1 })
    .eq('workspace_id', workspaceId)

  return `PRJ-${String(currentVal).padStart(3, '0')}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the Monday (YYYY-MM-DD) of the week containing `date`. */
function currentWeekStart(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ── GET /api/projects?workspace_id=&status=&page=&limit= ─────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const status   = searchParams.get('status')
  const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const from     = (page - 1) * limit
  const to       = from + limit - 1

  let query = (supabase as any)
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data: projects, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Mark which projects need a weekly update ──────────────────────────────
  // A project "needs weekly update" if its status is in_progress or review
  // AND no submitted (is_draft=false) update exists for the current week.
  const weekStart = currentWeekStart()
  const activeIds = (projects ?? [])
    .filter((p: any) => p.status === 'in_progress' || p.status === 'review')
    .map((p: any) => p.id)

  let submittedThisWeek = new Set<string>()
  if (activeIds.length > 0) {
    const { data: updates } = await (supabase as any)
      .from('project_weekly_updates')
      .select('project_id')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .eq('is_draft', false)
      .in('project_id', activeIds)
    submittedThisWeek = new Set((updates ?? []).map((u: any) => u.project_id))
  }

  const enriched = (projects ?? []).map((p: any) => ({
    ...p,
    needs_weekly_update:
      (p.status === 'in_progress' || p.status === 'review') &&
      !submittedThisWeek.has(p.id),
  }))

  return NextResponse.json({ projects: enriched, total: count ?? 0, page, limit })
}

// ── POST /api/projects ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    workspace_id,
    title,
    field,
    department,
    owner_id,
    owner_name,
    assignee_ids,
    assignees,
    status,
    sprint,
    start_date,
    due_date,
  } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const project_code = await nextProjectCode(supabase, workspace_id)
  const quarter = due_date ? computeQuarter(due_date) : null

  const insertPayload: Record<string, unknown> = {
    workspace_id,
    project_code,
    title: title.trim(),
    field:          field          ?? null,
    department:     department     ?? null,
    owner_id:       owner_id       ?? null,
    owner_name:     owner_name     ?? null,
    assignee_ids:   assignee_ids   ?? [],
    assignees:      assignees      ?? [],
    status:         status         ?? 'backlog',
    sprint:         sprint         ?? null,
    quarter,
    start_date:     start_date     ?? null,
    due_date:       due_date       ?? null,
    progress:       0,
    created_by:     user.id,
    created_by_name: userName,
    updated_by:     user.id,
    updated_by_name: userName,
  }

  const { data: project, error } = await (supabase as any)
    .from('projects')
    .insert(insertPayload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log project creation
  await logActivity({
    supabase,
    projectId: project.id,
    workspaceId: workspace_id,
    actorId: user.id,
    actorName: userName,
    action: 'created',
    entityType: 'project',
    entityId: project.id,
    entityTitle: project.title,
  })

  return NextResponse.json({ project }, { status: 201 })
}
