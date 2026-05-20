import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { data: automation, error } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ automation })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id, ...data } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const userName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'

  const updatePayload: Record<string, unknown> = {
    updated_by: user.id,
    updated_by_name: userName,
    updated_at: new Date().toISOString(),
  }
  if (data.name !== undefined) updatePayload.name = data.name
  if (data.trigger_type !== undefined) updatePayload.trigger_type = data.trigger_type
  if (data.trigger_config !== undefined) updatePayload.trigger_config = data.trigger_config
  if (data.steps !== undefined) updatePayload.steps = data.steps
  if (data.goal !== undefined) updatePayload.goal = data.goal
  if (data.status !== undefined) updatePayload.status = data.status
  if (data.scheduled_publish_at !== undefined) updatePayload.scheduled_publish_at = data.scheduled_publish_at

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .update(updatePayload)
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: row })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('email_automations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
