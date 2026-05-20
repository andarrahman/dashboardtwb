import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AutomationEventType } from '@/lib/supabase/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const event_type = (searchParams.get('event_type') ?? undefined) as AutomationEventType | undefined
  const contact_id  = searchParams.get('contact_id')  ?? undefined
  const enrollment_id = searchParams.get('enrollment_id') ?? undefined
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 50

  let query = (supabase as any)
    .from('automation_logs')
    .select('*', { count: 'exact' })
    .eq('automation_id', id)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: contact_id ? true : false }) // timeline: asc; default: desc
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (event_type)    query = query.eq('event_type', event_type)
  if (contact_id)    query = query.eq('contact_id', contact_id)
  if (enrollment_id) query = query.eq('metadata->>enrollment_id', enrollment_id)

  const { data: logs, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: logs ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id, event_type, event_label, description, metadata, contact_id } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { error } = await (supabase as any).from('automation_logs').insert({
    automation_id: id,
    workspace_id,
    contact_id: contact_id ?? null,
    event_type,
    event_label,
    description: description ?? null,
    metadata: metadata ?? {},
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
