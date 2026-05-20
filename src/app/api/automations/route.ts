import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const search = searchParams.get('search') ?? undefined
  const status = searchParams.get('status') || undefined
  const trigger = searchParams.get('trigger') || undefined
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20

  let query = (supabase as any)
    .from('email_automations')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('status', status)
  if (trigger) query = query.eq('trigger_type', trigger)

  const { data: automations, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Counts per status
  const { data: countRows } = await (supabase as any)
    .from('email_automations')
    .select('status')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  const counts = { all: 0, active: 0, paused: 0, draft: 0, archived: 0 }
  for (const r of countRows ?? []) {
    counts.all++
    if (r.status in counts) counts[r.status as keyof typeof counts]++
  }

  return NextResponse.json({ automations: automations ?? [], total: count ?? 0, counts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workspace_id, name, trigger_type, trigger_config, steps, goal } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const userName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'

  const { data: row, error } = await (supabase as any)
    .from('email_automations')
    .insert({
      workspace_id,
      name: name ?? 'Untitled workflow',
      status: 'draft',
      trigger_type: trigger_type ?? null,
      trigger_config: trigger_config ?? {},
      steps: steps ?? [],
      goal: goal ?? null,
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
  return NextResponse.json({ automation: row }, { status: 201 })
}
