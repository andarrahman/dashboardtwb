import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/projects/[id]/weekly-updates/[updateId]?workspace_id= ────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, updateId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { data: update, error } = await (supabase as any)
    .from('project_weekly_updates')
    .select('*')
    .eq('id', updateId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ update })
}

// ── PATCH /api/projects/[id]/weekly-updates/[updateId] ───────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, updateId } = await params
  const body = await req.json()
  const { workspace_id, ...data } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  // Fetch the update to enforce the edit window
  const { data: existing, error: fetchError } = await (supabase as any)
    .from('project_weekly_updates')
    .select('edit_window_closes_at, is_draft')
    .eq('id', updateId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspace_id)
    .is('deleted_at', null)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Enforce edit window: non-draft updates can only be edited before the window closes
  if (!existing.is_draft && existing.edit_window_closes_at) {
    const windowCloses = new Date(existing.edit_window_closes_at)
    if (new Date() > windowCloses) {
      return NextResponse.json(
        { error: 'Edit window has closed for this weekly update' },
        { status: 403 }
      )
    }
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const allowedFields = ['status', 'result', 'concern', 'plus', 'minus', 'is_draft'] as const
  for (const key of allowedFields) {
    if (data[key] !== undefined) updatePayload[key] = data[key]
  }

  // When publishing (is_draft going false), set submitted_at
  if (data.is_draft === false && existing.is_draft === true) {
    updatePayload.submitted_at = new Date().toISOString()
  }

  const { data: update, error } = await (supabase as any)
    .from('project_weekly_updates')
    .update(updatePayload)
    .eq('id', updateId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspace_id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ update })
}

// ── DELETE /api/projects/[id]/weekly-updates/[updateId]?workspace_id= ─────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, updateId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('project_weekly_updates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', updateId)
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
