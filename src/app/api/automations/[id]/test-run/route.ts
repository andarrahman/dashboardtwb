import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmailHtml } from '@/lib/email-html'
import { sendEmail } from '@/lib/email/resend'
import type { AutomationStep, MarketingTemplateRow } from '@/lib/supabase/types'

// POST /api/automations/[id]/test-run
// Body: { workspace_id, test_email }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { workspace_id, test_email } = body as { workspace_id: string; test_email: string }

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (!test_email) return NextResponse.json({ error: 'Missing test_email' }, { status: 400 })

  // Load automation
  const { data: automationRow, error: autoErr } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (autoErr || !automationRow) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  const steps: AutomationStep[] = automationRow.steps ?? []
  const emailSteps = steps.filter((s) => s.type === 'send_email')

  if (emailSteps.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No email steps found' })
  }

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  let sent = 0
  const sendErrors: string[] = []

  for (const step of emailSteps) {
    if (!step.template_id) continue

    // Load template
    const { data: template, error: tplErr } = await (supabase as any)
      .from('marketing_templates')
      .select('*')
      .eq('id', step.template_id)
      .single()

    if (tplErr || !template) {
      sendErrors.push(`Template not found for step: ${step.name}`)
      continue
    }

    // Generate HTML
    const html = generateEmailHtml(template as MarketingTemplateRow)

    const subject = step.subject_line ?? (template as MarketingTemplateRow & { subject?: string | null }).subject ?? template.subject_line ?? step.name ?? 'Test email'

    // Send email via Resend (pass workspaceId so it uses workspace email settings)
    try {
      const result = await sendEmail({ to: test_email, subject, html, workspaceId: workspace_id })
      if (result.error) {
        console.error(`[test-run] Step "${step.name}" failed:`, result.error)
        sendErrors.push(`Step "${step.name}": ${result.error}`)
      } else {
        sent++
      }
    } catch (fetchErr) {
      console.error(`[test-run] Network error for step "${step.name}":`, fetchErr)
      sendErrors.push(`Step "${step.name}": Network error`)
    }
  }

  // Log test run
  await (supabase as any).from('automation_logs').insert({
    automation_id: id,
    workspace_id,
    contact_id: null,
    event_type: 'workflow_edit',
    event_label: 'Test run',
    description: `Test run by ${userName} · ${sent} email(s) sent to ${test_email}`,
    metadata: { test_email, sent, errors: sendErrors },
  })

  return NextResponse.json({ sent, errors: sendErrors })
}
