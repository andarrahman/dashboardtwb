import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeQuarter(dueDateStr: string): string {
  const d = new Date(dueDateStr)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

// ── GET /api/projects/[id]?workspace_id= ─────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { data: project, error } = await (supabase as any)
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ project })
}

// ── PATCH /api/projects/[id] ──────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id, ...data } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const updatePayload: Record<string, unknown> = {
    updated_by:      user.id,
    updated_by_name: userName,
    updated_at:      new Date().toISOString(),
  }

  const allowedFields = [
    'title', 'field', 'department', 'owner_id', 'owner_name',
    'assignee_ids', 'assignees', 'status', 'sprint',
    'start_date', 'due_date', 'progress',
  ] as const

  for (const key of allowedFields) {
    if (data[key] !== undefined) updatePayload[key] = data[key]
  }

  // Recompute quarter when due_date is being updated
  if (data.due_date !== undefined) {
    updatePayload.quarter = data.due_date ? computeQuarter(data.due_date) : null
  }

  const { data: project, error } = await (supabase as any)
    .from('projects')
    .update(updatePayload)
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Log project update
  const changedFields = Object.keys(data)
  if (changedFields.includes('status')) {
    await logActivity({
      supabase,
      projectId: id,
      workspaceId: workspace_id,
      actorId: user.id,
      actorName: userName,
      action: 'status_changed',
      entityType: 'project',
      entityId: id,
      entityTitle: project.title,
      meta: { old_value: (data as any)._prev_status, new_value: data.status },
    })
  } else {
    await logActivity({
      supabase,
      projectId: id,
      workspaceId: workspace_id,
      actorId: user.id,
      actorName: userName,
      action: 'updated',
      entityType: 'project',
      entityId: id,
      entityTitle: project.title,
      meta: { fields: changedFields },
    })
  }

  return NextResponse.json({ project })
}

// ── DELETE /api/projects/[id]?workspace_id= ───────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
