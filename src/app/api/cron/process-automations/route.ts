import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, isEmailSuppressed } from '@/lib/email/resend'
import { injectTracking } from '@/lib/email/tracking'
import type { EmailAutomationRow, AutomationStep, AutomationTriggerConfig } from '@/lib/supabase/types'

function computeNextActionAt(step: AutomationStep): string {
  const days = step.delay_days ?? 0
  const hours = step.delay_hours ?? 0
  const ms = (days * 24 * 60 * 60 + hours * 60 * 60) * 1000
  return new Date(Date.now() + ms).toISOString()
}

interface SendWindow {
  enabled: boolean
  start: string
  end: string
  timezone: string
  skip_weekends: boolean
}

function isWithinSendWindow(sendWindow: SendWindow | undefined): boolean {
  if (!sendWindow?.enabled) return true
  const tz = sendWindow.timezone ?? 'UTC'
  const timeStr = new Date().toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [h, m] = timeStr.split(':').map(Number)
  const current = h * 60 + (m ?? 0)
  const [sh, sm] = sendWindow.start.split(':').map(Number)
  const [eh, em] = sendWindow.end.split(':').map(Number)
  const start = (sh ?? 9) * 60 + (sm ?? 0)
  const end = (eh ?? 17) * 60 + (em ?? 0)
  if (sendWindow.skip_weekends) {
    const day = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
    if (day === 'Sat' || day === 'Sun') return false
  }
  return current >= start && current <= end
}

function applyVariables(html: string, data: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
  }
  return result
}

// GET /api/cron/process-automations
// Called by Vercel Cron or external cron
export async function GET(request: NextRequest) {
  // Auth: check for CRON_SECRET header or skip auth in dev
  const secret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Find all due enrollments: next_action_at <= now() and status = 'active'
  const { data: dueEnrollments } = await (supabase as any)
    .from('automation_enrollments')
    .select(`*, automation:email_automations(*)`)
    .eq('status', 'active')
    .lte('next_action_at', new Date().toISOString())
    .limit(100) // process in batches

  let processed = 0
  let errors = 0
  let skipped = 0

  // Rate limiting: per-automation email counter (max 50 per cron run)
  const automationEmailCount = new Map<string, number>()

  // Cooldown: track recent email recipients (contact_id)
  // Check contacts who got > 3 emails in last hour across all automations
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentLogs } = await (supabase as any)
    .from('automation_logs')
    .select('contact_id')
    .eq('event_type', 'email_sent')
    .gte('created_at', oneHourAgo)

  const recentEmailCount = new Map<string, number>()
  for (const log of (recentLogs ?? []) as { contact_id: string | null }[]) {
    if (!log.contact_id) continue
    recentEmailCount.set(log.contact_id, (recentEmailCount.get(log.contact_id) ?? 0) + 1)
  }

  for (const enrollment of (dueEnrollments ?? []) as Record<string, unknown>[]) {
    try {
      const automation = enrollment.automation as EmailAutomationRow
      if (!automation || automation.status !== 'active') continue

      // Check send window
      const triggerConfig = automation.trigger_config as AutomationTriggerConfig & {
        send_window?: SendWindow
        exit_conditions?: { exit_on_reply?: boolean; exit_on_goal?: boolean; exit_on_list_removal?: boolean }
      }
      const sendWindow = triggerConfig?.send_window
      if (!isWithinSendWindow(sendWindow)) {
        skipped++
        continue
      }

      // Check exit conditions: exit_on_list_removal
      const exitConditions = triggerConfig?.exit_conditions
      if (exitConditions?.exit_on_list_removal && triggerConfig?.list_id) {
        const { data: listMembership } = await (supabase as any)
          .from('crm_list_contacts')
          .select('contact_id')
          .eq('list_id', triggerConfig.list_id)
          .eq('contact_id', enrollment.contact_id)
          .limit(1)
          .maybeSingle()

        if (!listMembership) {
          // Contact removed from list — exit enrollment
          await (supabase as any)
            .from('automation_enrollments')
            .update({
              status: 'exited',
              exit_reason: 'list_removal',
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id)
          await (supabase as any).from('automation_logs').insert({
            automation_id: automation.id,
            workspace_id: automation.workspace_id,
            contact_id: enrollment.contact_id,
            event_type: 'exited',
            event_label: 'Exited: removed from list',
            description: 'Contact was removed from the trigger list',
            metadata: { enrollment_id: enrollment.id, step_index: enrollment.current_step_index },
          })
          processed++
          continue
        }
      }

      const steps: AutomationStep[] = automation.steps ?? []
      const stepIndex: number = (enrollment.current_step_index as number) ?? 0
      const enrollmentMeta: Record<string, unknown> = (enrollment.metadata as Record<string, unknown>) ?? {}

      // ── Branch context: execute a sub-step inside an if/else branch ──────────
      interface BranchCtxShape {
        parent_step_index: number
        branch: 'yes' | 'no'
        sub_step_index: number
      }
      const branchCtx = enrollmentMeta.branch_context as BranchCtxShape | undefined

      if (branchCtx) {
        const parentStep = steps[branchCtx.parent_step_index] as AutomationStep | undefined
        const branchSteps: AutomationStep[] = branchCtx.branch === 'yes'
          ? (parentStep?.yes_steps ?? [])
          : (parentStep?.no_steps ?? [])
        const subStepIdx = branchCtx.sub_step_index
        const subStep = branchSteps[subStepIdx] as AutomationStep | undefined

        const advanceBranch = async (respectDelay = true) => {
          const nextSubIdx = subStepIdx + 1
          const nextSubStep = branchSteps[nextSubIdx] as AutomationStep | undefined
          if (nextSubIdx >= branchSteps.length) {
            // Branch exhausted — advance past the if_else in the main flow
            const nextMainIdx = branchCtx.parent_step_index + 1
            const nextMainStep = steps[nextMainIdx] as AutomationStep | undefined
            const nextAt = nextMainStep?.type === 'wait_delay'
              ? computeNextActionAt(nextMainStep)
              : new Date().toISOString()
            await (supabase as any).from('automation_enrollments').update({
              current_step_index: nextMainIdx,
              current_step_name: nextMainStep?.name ?? null,
              next_action_at: nextMainIdx >= steps.length ? null : nextAt,
              metadata: { ...enrollmentMeta, branch_context: null },
              updated_at: new Date().toISOString(),
            }).eq('id', enrollment.id)
          } else {
            const nextAt = respectDelay && nextSubStep?.type === 'wait_delay'
              ? computeNextActionAt(nextSubStep)
              : new Date().toISOString()
            await (supabase as any).from('automation_enrollments').update({
              metadata: { ...enrollmentMeta, branch_context: { ...branchCtx, sub_step_index: nextSubIdx } },
              next_action_at: nextAt,
              updated_at: new Date().toISOString(),
            }).eq('id', enrollment.id)
          }
        }

        if (!subStep || subStepIdx >= branchSteps.length) {
          // Branch empty / exhausted
          await advanceBranch()
        } else if (subStep.type === 'send_email') {
          const { data: contact } = await (supabase as any)
            .from('contacts').select('email, name').eq('id', enrollment.contact_id).single()
          if (contact?.email && subStep.template_id) {
            const suppressed = await isEmailSuppressed(contact.email as string)
            if (!suppressed) {
              const { data: template } = await (supabase as any)
                .from('marketing_templates').select('html_content, subject_line').eq('id', subStep.template_id).single()
              if (template) {
                const subject = subStep.subject_line ?? (template as { subject_line?: string }).subject_line ?? subStep.name ?? 'Email'
                let html = (template as { html_content?: string }).html_content ?? ''
                const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
                html = applyVariables(html, {
                  first_name: (contact.name as string)?.split(' ')[0] ?? '',
                  full_name: (contact.name as string) ?? '',
                  email: contact.email as string,
                  unsubscribe_url: `${appUrl}/unsubscribe?token=${enrollment.contact_id as string}-${automation.workspace_id}`,
                  manage_preferences_url: `${appUrl}/unsubscribe?token=${enrollment.contact_id as string}-${automation.workspace_id}`,
                })
                html = injectTracking(html, {
                  enrollmentId: enrollment.id as string,
                  contactId: enrollment.contact_id as string,
                  automationId: automation.id,
                  stepIndex: subStepIdx,
                  appUrl,
                })
                const sr = await sendEmail({ to: contact.email as string, subject, html, workspaceId: automation.workspace_id })
                if (sr.error) console.warn(`[process-automations] Branch send failed: ${sr.error}`)
              }
            }
            await (supabase as any).from('automation_logs').insert({
              automation_id: automation.id,
              workspace_id: automation.workspace_id,
              contact_id: enrollment.contact_id,
              event_type: 'email_sent',
              event_label: `Email sent: ${subStep.name}`,
              description: `Branch ${branchCtx.branch.toUpperCase()} sub-step ${subStepIdx + 1}`,
              metadata: { step_index: stepIndex, sub_step_index: subStepIdx, enrollment_id: enrollment.id },
            })
          }
          await advanceBranch()
        } else if (subStep.type === 'wait_delay') {
          // Delay already elapsed — advance to next sub-step
          await advanceBranch(false)
        } else if (subStep.type === 'end_workflow') {
          await (supabase as any).from('automation_enrollments').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('id', enrollment.id)
        } else if (subStep.type === 'tag_contact' && subStep.tag) {
          const { data: contact } = await (supabase as any)
            .from('contacts').select('custom_fields').eq('id', enrollment.contact_id).single()
          const tags: string[] = ((contact?.custom_fields as { tags?: string[] } | null)?.tags) ?? []
          if (!tags.includes(subStep.tag)) {
            await (supabase as any).from('contacts').update({
              custom_fields: { ...((contact?.custom_fields as Record<string, unknown>) ?? {}), tags: [...tags, subStep.tag] },
            }).eq('id', enrollment.contact_id)
          }
          await advanceBranch()
        } else {
          // Unhandled sub-step type — advance anyway
          await advanceBranch()
        }

        processed++
        continue
      }
      // ── End branch context ────────────────────────────────────────────────────

      if (stepIndex >= steps.length) {
        // Complete the enrollment
        await (supabase as any)
          .from('automation_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
        processed++
        continue
      }

      const step = steps[stepIndex]

      if (step.type === 'send_email') {
        // Per-automation rate limit (max 50 emails per cron run)
        const automationCount = automationEmailCount.get(automation.id) ?? 0
        if (automationCount >= 50) {
          skipped++
          continue
        }

        // Cooldown: skip contact if > 3 emails in last hour
        const contactEmailCount = recentEmailCount.get(enrollment.contact_id as string) ?? 0
        if (contactEmailCount > 3) {
          skipped++
          continue
        }

        // Get contact email
        const { data: contact } = await (supabase as any)
          .from('contacts')
          .select('email, name')
          .eq('id', enrollment.contact_id)
          .single()

        if (contact?.email && step.template_id) {
          // Check suppression list before sending
          const suppressed = await isEmailSuppressed(contact.email as string)
          if (suppressed) {
            await (supabase as any).from('automation_logs').insert({
              automation_id: automation.id,
              workspace_id: automation.workspace_id,
              contact_id: enrollment.contact_id,
              event_type: 'exited',
              event_label: 'Skipped: email suppressed',
              description: `${contact.email as string} is on suppression list`,
              metadata: { step_index: stepIndex },
            })
          } else {
          const { data: template } = await (supabase as any)
            .from('marketing_templates')
            .select('html_content, subject_line, name')
            .eq('id', step.template_id)
            .single()

          if (template) {
            const subject = step.subject_line ?? (template as { subject_line?: string | null }).subject_line ?? step.name ?? 'Email'
            let html = (template as { html_content?: string | null }).html_content ?? ''

            // Apply contact variables
            html = applyVariables(html, {
              first_name: (contact.name as string)?.split(' ')[0] ?? '',
              full_name: (contact.name as string) ?? '',
              email: contact.email as string,
              unsubscribe_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/unsubscribe?token=${enrollment.contact_id as string}-${automation.workspace_id}`,
              manage_preferences_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/unsubscribe?token=${enrollment.contact_id as string}-${automation.workspace_id}`,
            })

            // Inject open/click tracking
            html = injectTracking(html, {
              enrollmentId: enrollment.id as string,
              contactId: enrollment.contact_id as string,
              automationId: automation.id,
              stepIndex,
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
            })

            const sendResult = await sendEmail({ to: contact.email as string, subject, html, workspaceId: automation.workspace_id })
            if (sendResult.error) {
              console.warn(`[process-automations] Send failed for enrollment ${enrollment.id as string}: ${sendResult.error}`)
            }

            // Update automation email counters
            automationEmailCount.set(automation.id, automationCount + 1)
            recentEmailCount.set(
              enrollment.contact_id as string,
              (recentEmailCount.get(enrollment.contact_id as string) ?? 0) + 1
            )
          }
          } // end suppression check

          // Log the email_sent event
          const subject = step.subject_line ?? step.name ?? 'Email'
          await (supabase as any).from('automation_logs').insert({
            automation_id: automation.id,
            workspace_id: automation.workspace_id,
            contact_id: enrollment.contact_id,
            event_type: 'email_sent',
            event_label: `Email sent: ${step.name}`,
            description: `Subject: ${subject} · Template: ${step.template_name ?? step.template_id}`,
            metadata: { step_index: stepIndex, step_name: step.name },
          })
        }

        // Advance to next step
        const nextIndex = stepIndex + 1
        const nextStep: AutomationStep | undefined = steps[nextIndex]
        const nextActionAt =
          nextStep?.type === 'wait_delay'
            ? computeNextActionAt(nextStep)
            : new Date().toISOString()

        await (supabase as any)
          .from('automation_enrollments')
          .update({
            current_step_index: nextIndex,
            current_step_name: nextStep?.name ?? null,
            next_action_at: nextIndex >= steps.length ? null : nextActionAt,
            next_step_name: steps[nextIndex + 1]?.name ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else if (step.type === 'wait_delay') {
        // Delay already elapsed (we only pick up due enrollments)
        // Advance past the delay
        const nextIndex = stepIndex + 1
        const nextStep: AutomationStep | undefined = steps[nextIndex]
        const nextActionAt =
          nextStep?.type === 'wait_delay'
            ? computeNextActionAt(nextStep)
            : new Date().toISOString()

        await (supabase as any)
          .from('automation_enrollments')
          .update({
            current_step_index: nextIndex,
            current_step_name: nextStep?.name ?? null,
            next_action_at: nextIndex >= steps.length ? null : nextActionAt,
            next_step_name: steps[nextIndex + 1]?.name ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else if (step.type === 'end_workflow') {
        await (supabase as any)
          .from('automation_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else if (step.type === 'tag_contact' && step.tag) {
        // Apply tag via custom_fields
        const { data: contact } = await (supabase as any)
          .from('contacts')
          .select('custom_fields')
          .eq('id', enrollment.contact_id)
          .single()

        const tags: string[] = (((contact as { custom_fields?: Record<string, unknown> })?.custom_fields)?.tags as string[]) ?? []
        if (!tags.includes(step.tag)) {
          await (supabase as any)
            .from('contacts')
            .update({
              custom_fields: {
                ...((contact as { custom_fields?: Record<string, unknown> })?.custom_fields ?? {}),
                tags: [...tags, step.tag],
              },
            })
            .eq('id', enrollment.contact_id)
        }

        // Advance
        const nextIndex = stepIndex + 1
        const nextStep: AutomationStep | undefined = steps[nextIndex]
        await (supabase as any)
          .from('automation_enrollments')
          .update({
            current_step_index: nextIndex,
            current_step_name: nextStep?.name ?? null,
            next_action_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else if (step.type === 'move_to_list' && step.list_id) {
        // Add contact to target list
        await (supabase as any).from('crm_list_contacts').upsert(
          {
            list_id: step.list_id,
            contact_id: enrollment.contact_id,
            workspace_id: automation.workspace_id,
            added_by: null,
            added_by_name: 'Automation',
          },
          { onConflict: 'list_id,contact_id' }
        )

        // Advance
        const nextIndex = stepIndex + 1
        const nextStep: AutomationStep | undefined = steps[nextIndex]
        await (supabase as any)
          .from('automation_enrollments')
          .update({
            current_step_index: nextIndex,
            current_step_name: nextStep?.name ?? null,
            next_action_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else if (step.type === 'if_else') {
        // ── Evaluate condition and set branch_context ─────────────────────────
        const field = step.condition_field
        const operator = step.condition_operator ?? 'is'
        const value = step.condition_value ?? ''
        let conditionResult = false

        if (field === 'opened_email') {
          const { count } = await (supabase as any)
            .from('automation_logs')
            .select('id', { count: 'exact', head: true })
            .eq('automation_id', automation.id)
            .eq('contact_id', enrollment.contact_id)
            .eq('event_type', 'opened')
          conditionResult = (count ?? 0) > 0
        } else if (field === 'clicked_link') {
          const { count } = await (supabase as any)
            .from('automation_logs')
            .select('id', { count: 'exact', head: true })
            .eq('automation_id', automation.id)
            .eq('contact_id', enrollment.contact_id)
            .eq('event_type', 'clicked')
          conditionResult = (count ?? 0) > 0
        } else if (field === 'has_tag') {
          const { data: contactForTag } = await (supabase as any)
            .from('contacts')
            .select('custom_fields')
            .eq('id', enrollment.contact_id)
            .single()
          const tags: string[] = ((contactForTag?.custom_fields as { tags?: string[] } | null)?.tags) ?? []
          if (operator === 'is') conditionResult = tags.includes(value)
          else if (operator === 'is_not') conditionResult = !tags.includes(value)
          else if (operator === 'contains') conditionResult = tags.some((t) => t.includes(value))
        }

        const chosenBranch: 'yes' | 'no' = conditionResult ? 'yes' : 'no'
        const branchStepsForEval: AutomationStep[] = chosenBranch === 'yes'
          ? (step.yes_steps ?? [])
          : (step.no_steps ?? [])

        if (branchStepsForEval.length === 0) {
          // Empty branch — skip straight to next main step
          const nextIndex = stepIndex + 1
          const nextStep: AutomationStep | undefined = steps[nextIndex]
          await (supabase as any).from('automation_enrollments').update({
            current_step_index: nextIndex,
            current_step_name: nextStep?.name ?? null,
            next_action_at: nextIndex >= steps.length ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', enrollment.id)
        } else {
          // Set branch_context so next cron tick executes the first sub-step
          await (supabase as any).from('automation_enrollments').update({
            metadata: { ...enrollmentMeta, branch_context: { parent_step_index: stepIndex, branch: chosenBranch, sub_step_index: 0 } },
            next_action_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', enrollment.id)
        }

        await (supabase as any).from('automation_logs').insert({
          automation_id: automation.id,
          workspace_id: automation.workspace_id,
          contact_id: enrollment.contact_id,
          event_type: 'workflow_edit',
          event_label: `Branch taken: ${chosenBranch.toUpperCase()}`,
          description: `Condition "${field}" evaluated → ${chosenBranch}`,
          metadata: { step_index: stepIndex, enrollment_id: enrollment.id },
        })
      }

      processed++
    } catch (err) {
      console.error('Error processing enrollment', enrollment.id, err)
      errors++
    }
  }

  console.log(`[process-automations] processed=${processed} errors=${errors} skipped=${skipped}`)

  return NextResponse.json({
    processed,
    errors,
    skipped,
    total: ((dueEnrollments as unknown[]) ?? []).length,
  })
}
