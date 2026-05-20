import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

// ── Helper: recalculate project.progress based on done/total tasks ────────────
async function recalculateProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const { count: total } = await (supabase as any)
    .from('project_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null)

  const { count: done } = await (supabase as any)
    .from('project_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'done')
    .is('deleted_at', null)

  const totalCount = total ?? 0
  const doneCount  = done  ?? 0
  const progress   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  await (supabase as any)
    .from('projects')
    .update({ progress, updated_at: new Date().toISOString() })
    .eq('id', projectId)
}

// ── GET /api/projects/[id]/tasks?workspace_id= ────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { data: tasks, error } = await (supabase as any)
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks })
}

// ── POST /api/projects/[id]/tasks ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const body = await req.json()
  const {
    workspace_id,
    title,
    status,
    assignee_id,
    assignee_name,
    assignee_avatar_url,
    start_date,
    due_date,
    sort_order,
    parent_task_id,
  } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  // Determine sort_order: use provided value or place at end
  let taskSortOrder = sort_order
  if (taskSortOrder === undefined || taskSortOrder === null) {
    const { count } = await (supabase as any)
      .from('project_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null)
    taskSortOrder = (count ?? 0) + 1
  }

  const insertPayload: Record<string, unknown> = {
    project_id:          projectId,
    workspace_id,
    title:               title.trim(),
    status:              status              ?? 'backlog',
    assignee_id:         assignee_id         ?? null,
    assignee_name:       assignee_name       ?? null,
    assignee_avatar_url: assignee_avatar_url ?? null,
    start_date:          start_date          ?? null,
    due_date:            due_date            ?? null,
    sort_order:          taskSortOrder,
    parent_task_id:      parent_task_id ?? null,
    created_by:          user.id,
    created_by_name:     userName,
    updated_by:          user.id,
    updated_by_name:     userName,
  }

  const { data: task, error } = await (supabase as any)
    .from('project_tasks')
    .insert(insertPayload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate project progress after task insert
  await recalculateProgress(supabase, projectId)

  // Log activity
  await logActivity({
    supabase,
    projectId,
    workspaceId: workspace_id,
    actorId: user.id,
    actorName: userName,
    action: 'created',
    entityType: parent_task_id ? 'subtask' : 'task',
    entityId: task.id,
    entityTitle: task.title,
  })

  return NextResponse.json({ task }, { status: 201 })
}
