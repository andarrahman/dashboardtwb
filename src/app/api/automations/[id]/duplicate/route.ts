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

  // Fetch original
  const { data: original, error: fetchErr } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: copy, error } = await (supabase as any)
    .from('email_automations')
    .insert({
      workspace_id,
      name: `${original.name} (Copy)`,
      status: 'draft',
      trigger_type: original.trigger_type,
      trigger_config: original.trigger_config,
      steps: original.steps,
      goal: original.goal,
      total_enrolled: 0,
      total_completed: 0,
      owner_id: user.id,
      owner_name: userName,
      created_by: user.id,
      created_by_name: userName,
      updated_by: user.id,
      updated_by_name: userName,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: copy }, { status: 201 })
}
