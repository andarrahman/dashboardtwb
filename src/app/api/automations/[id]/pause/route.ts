import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const userName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'

  // Fetch current status
  const { data: current } = await (supabase as any)
    .from('email_automations')
    .select('status')
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .single()

  const isPaused = current?.status === 'active'
  const newStatus = isPaused ? 'paused' : 'active'

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .update({
      status: newStatus,
      paused_at: isPaused ? new Date().toISOString() : null,
      updated_by: user.id,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await (supabase as any).from('automation_logs').insert({
    automation_id: id,
    workspace_id,
    event_type: isPaused ? 'paused' : 'resumed',
    event_label: isPaused ? 'Workflow paused' : 'Workflow resumed',
    description: `${isPaused ? 'Paused' : 'Resumed'} by ${userName}`,
    metadata: {},
  })

  return NextResponse.json({ automation: row })
}
