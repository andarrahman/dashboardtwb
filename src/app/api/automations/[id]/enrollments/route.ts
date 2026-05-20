import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id, contact_id } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (!contact_id)   return NextResponse.json({ error: 'Missing contact_id' }, { status: 400 })

  // Fetch automation to get re_enroll policy
  const { data: automation, error: autoErr } = await (supabase as any)
    .from('email_automations')
    .select('trigger_config')
    .eq('id', id)
    .eq('workspace_id', workspace_id)
    .single()

  if (autoErr || !automation) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  const re_enroll: string = (automation.trigger_config as { re_enroll?: string } | null)?.re_enroll ?? 'never'

  if (re_enroll === 'never') {
    // Reject if any enrollment already exists (any status)
    const { count } = await (supabase as any)
      .from('automation_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', id)
      .eq('workspace_id', workspace_id)
      .eq('contact_id', contact_id)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Contact already enrolled (re_enroll=never)', code: 'already_enrolled' }, { status: 409 })
    }
  } else if (re_enroll === 'once_per_90d') {
    // Reject if any enrollment exists within the last 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await (supabase as any)
      .from('automation_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', id)
      .eq('workspace_id', workspace_id)
      .eq('contact_id', contact_id)
      .gte('enrolled_at', cutoff)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Contact enrolled within the last 90 days (re_enroll=once_per_90d)', code: 'too_soon' }, { status: 409 })
    }
  }
  // re_enroll === 'always': no restrictions

  // Create enrollment
  const now = new Date().toISOString()
  const { data: enrollment, error: insertErr } = await (supabase as any)
    .from('automation_enrollments')
    .insert({
      automation_id: id,
      workspace_id,
      contact_id,
      status: 'active',
      current_step_index: 0,
      enrolled_at: now,
      next_action_at: now,
      metadata: {},
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json({ enrollment }, { status: 201 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const status = searchParams.get('status') || undefined
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20

  let query = (supabase as any)
    .from('automation_enrollments')
    .select('*, contact:contacts(id, name, email)', { count: 'exact' })
    .eq('automation_id', id)
    .eq('workspace_id', workspaceId)
    .order('enrolled_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status)

  const { data: enrollments, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrollments: enrollments ?? [], total: count ?? 0 })
}
