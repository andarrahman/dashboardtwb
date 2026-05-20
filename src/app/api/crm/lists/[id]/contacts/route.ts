import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function enrollContactInMatchingAutomations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  listId: string,
  contactId: string
) {
  // Find active automations with list_subscription trigger for this list
  const { data: automations } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .eq('trigger_type', 'list_subscription')
    .is('deleted_at', null)

  for (const automation of automations ?? []) {
    const config = automation.trigger_config ?? {}
    if (config.list_id !== listId) continue

    // Check re-enroll policy
    const { data: existing } = await (supabase as any)
      .from('automation_enrollments')
      .select('id, status')
      .eq('automation_id', automation.id)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)

    const hasActive = (existing as Array<{ id: string; status: string }> | null)?.some(
      (e) => e.status === 'active'
    )
    if (hasActive) continue // already enrolled

    const reEnroll: string = config.re_enroll ?? 'never'
    if (reEnroll === 'never' && existing && (existing as unknown[]).length > 0) continue

    // Find first step for initial next_action_at
    const steps: Array<{ type: string; name?: string; delay_days?: number; delay_hours?: number }> =
      automation.steps ?? []
    const firstStep = steps[0]
    const nextActionAt =
      firstStep?.type === 'wait_delay'
        ? new Date(
            Date.now() +
              ((firstStep.delay_days ?? 0) * 86400 + (firstStep.delay_hours ?? 0) * 3600) * 1000
          ).toISOString()
        : new Date().toISOString()

    // Enroll
    await (supabase as any).from('automation_enrollments').insert({
      automation_id: automation.id,
      workspace_id: workspaceId,
      contact_id: contactId,
      current_step_index: 0,
      current_step_name: firstStep?.name ?? null,
      next_action_at: nextActionAt,
      next_step_name: steps[1]?.name ?? null,
      status: 'active',
      enrolled_at: new Date().toISOString(),
    })

    // Log enrollment
    await (supabase as any).from('automation_logs').insert({
      automation_id: automation.id,
      workspace_id: workspaceId,
      contact_id: contactId,
      event_type: 'enrolled',
      event_label: 'Contact enrolled in workflow',
      description: `Triggered by: Added to list "${config.list_name ?? listId}"`,
      metadata: { list_id: listId, trigger: 'list_subscription' },
    })

    // Increment total_enrolled counter
    await (supabase as any)
      .from('email_automations')
      .update({ total_enrolled: (automation.total_enrolled ?? 0) + 1 })
      .eq('id', automation.id)
  }
}

// POST /api/crm/lists/[id]/contacts
// Body: { workspace_id, contact_ids: string[] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: listId } = await params
  const body = await req.json()
  const { workspace_id, contact_ids } = body as {
    workspace_id: string
    contact_ids: string[]
  }

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
    return NextResponse.json({ error: 'contact_ids must be a non-empty array' }, { status: 400 })
  }

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const rows = contact_ids.map((contactId) => ({
    list_id: listId,
    contact_id: contactId,
    workspace_id,
    added_by: user.id,
    added_by_name: userName,
  }))

  const { data, error } = await (supabase as any)
    .from('crm_list_contacts')
    .upsert(rows, { onConflict: 'list_id,contact_id', ignoreDuplicates: true })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync contact count
  const { count } = await (supabase as any)
    .from('crm_list_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id)
    .eq('list_id', listId)

  await (supabase as any)
    .from('crm_lists')
    .update({ contact_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)
    .eq('id', listId)

  // Trigger automation enrollments (fire-and-forget — don't block response)
  Promise.all(
    contact_ids.map((contactId) =>
      enrollContactInMatchingAutomations(supabase, workspace_id, listId, contactId)
    )
  ).catch(console.error)

  return NextResponse.json({ added: (data as unknown[])?.length ?? 0 })
}

// DELETE /api/crm/lists/[id]/contacts?workspace_id=...&contact_id=...
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: listId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  const contactId = searchParams.get('contact_id')

  if (!workspaceId || !contactId) {
    return NextResponse.json({ error: 'Missing workspace_id or contact_id' }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from('crm_list_contacts')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('list_id', listId)
    .eq('contact_id', contactId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
