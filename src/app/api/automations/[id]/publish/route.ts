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

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .update({
      status: 'active',
      published_at: new Date().toISOString(),
      updated_by: user.id,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log publish event
  await (supabase as any).from('automation_logs').insert({
    automation_id: id,
    workspace_id,
    event_type: 'published',
    event_label: 'Workflow published',
    description: `Published by ${userName}`,
    metadata: {},
  })

  return NextResponse.json({ automation: row })
}
