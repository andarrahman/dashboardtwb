import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/automations/[id]/enrollments/[enrollmentId]/retry
// Resets enrollment status to 'active' and sets next_action_at to now
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: automationId, enrollmentId } = await params
  const body = await req.json()
  const { workspace_id } = body as { workspace_id: string }

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  // Verify automation belongs to workspace
  const { data: automation } = await (supabase as any)
    .from('email_automations')
    .select('id, workspace_id')
    .eq('id', automationId)
    .eq('workspace_id', workspace_id)
    .single()

  if (!automation) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  // Update enrollment status to active and reset next_action_at
  const { data: enrollment, error } = await (supabase as any)
    .from('automation_enrollments')
    .update({
      status: 'active',
      exit_reason: null,
      next_action_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)
    .eq('automation_id', automationId)
    .eq('workspace_id', workspace_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enrollment })
}
