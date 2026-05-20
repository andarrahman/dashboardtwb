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

// ── PATCH /api/projects/[id]/tasks/[taskId] ───────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, taskId } = await params
  const body = await req.json()
  const { workspace_id, ...data } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  // Fetch current task to detect status changes
  const { data: currentTask } = await (supabase as any)
    .from('project_tasks')
    .select('status, parent_task_id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspace_id)
    .is('deleted_at', null)
    .single()

  if (!currentTask) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updatePayload: Record<string, unknown> = {
    updated_by:      user.id,
    updated_by_name: userName,
    updated_at:      new Date().toISOString(),
  }

  const allowedFields = [
    'title', 'status', 'assignee_id', 'assignee_name',
    'assignee_avatar_url', 'start_date', 'due_date', 'sort_order', 'parent_task_id',
  ] as const

  for (const key of allowedFields) {
    if (data[key] !== undefined) updatePayload[key] = data[key]
  }

  const { data: task, error } = await (supabase as any)
    .from('project_tasks')
    .update(updatePayload)
    .eq('id', taskId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspace_id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Recalculate progress if status was changed to or from 'done'
  const statusChanged  = data.status !== undefined && data.status !== currentTask.status
  const doneInvolved   = data.status === 'done' || currentTask.status === 'done'
  if (statusChanged && doneInvolved) {
    await recalculateProgress(supabase, projectId)
  }

  // Determine entity type
  const isSubtask = !!task.parent_task_id

  // Log status change specifically
  if (data.status !== undefined && data.status !== currentTask.status) {
    await logActivity({
      supabase,
      projectId,
      workspaceId: workspace_id,
      actorId: user.id,
      actorName: userName,
      action: 'status_changed',
      entityType: isSubtask ? 'subtask' : 'task',
      entityId: task.id,
      entityTitle: task.title,
      meta: { old_value: currentTask.status, new_value: data.status },
    })
  } else {
    // General update
    const changedFields = Object.keys(data).filter(k => k !== 'workspace_id')
    await logActivity({
      supabase,
      projectId,
      workspaceId: workspace_id,
      actorId: user.id,
      actorName: userName,
      action: 'updated',
      entityType: isSubtask ? 'subtask' : 'task',
      entityId: task.id,
      entityTitle: task.title,
      meta: { fields: changedFields },
    })
  }

  return NextResponse.json({ task })
}

// ── DELETE /api/projects/[id]/tasks/[taskId]?workspace_id= ───────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, taskId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  // Fetch status before soft-deleting (to decide if progress needs recalculation)
  const { data: taskBefore } = await (supabase as any)
    .from('project_tasks')
    .select('status, title, parent_task_id')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .single()

  const { error } = await (supabase as any)
    .from('project_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Always recalculate progress after a task deletion
  if (taskBefore) {
    await recalculateProgress(supabase, projectId)
  }

  if (taskBefore) {
    await logActivity({
      supabase,
      projectId,
      workspaceId: workspaceId,
      actorId: user.id,
      actorName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
      action: 'deleted',
      entityType: taskBefore.parent_task_id ? 'subtask' : 'task',
      entityId: taskId,
      entityTitle: taskBefore.title,
    })
  }

  return NextResponse.json({ ok: true })
}
