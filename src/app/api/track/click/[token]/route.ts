import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeToken } from '@/lib/email/tracking'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = decodeToken(token)

  if (!payload?.url) return NextResponse.redirect('https://twibbonize.com')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: automation } = await (supabase as any)
    .from('email_automations')
    .select('workspace_id, goal')
    .eq('id', payload.automationId)
    .single()

  if (automation) {
    await (supabase as any).from('automation_logs').insert({
      automation_id: payload.automationId,
      workspace_id: (automation as { workspace_id: string; goal: string | null }).workspace_id,
      contact_id: payload.contactId,
      event_type: 'clicked',
      event_label: 'Link clicked',
      description: `Clicked: ${payload.url}`,
      metadata: { enrollment_id: payload.enrollmentId, step_index: payload.stepIndex, url: payload.url },
    })

    // Goal tracking: check if clicked URL matches goal keyword (basic heuristic)
    const goal = (automation as { workspace_id: string; goal: string | null }).goal
    if (goal) {
      const goalKeywords = goal.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
      const urlLower = payload.url.toLowerCase()
      const goalAchieved = goalKeywords.some((kw: string) => urlLower.includes(kw))
      if (goalAchieved) {
        await (supabase as any)
          .from('automation_enrollments')
          .update({
            status: 'exited',
            exit_reason: 'goal_achieved',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.enrollmentId)
      }
    }
  }

  return NextResponse.redirect(payload.url)
}

