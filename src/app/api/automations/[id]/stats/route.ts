import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const [enrollRes, logRes] = await Promise.all([
    (supabase as any)
      .from('automation_enrollments')
      .select('status, exit_reason')
      .eq('automation_id', id)
      .eq('workspace_id', workspaceId),
    (supabase as any)
      .from('automation_logs')
      .select('event_type, metadata')
      .eq('automation_id', id)
      .eq('workspace_id', workspaceId)
      .in('event_type', ['email_sent', 'opened', 'clicked']),
  ])

  if (enrollRes.error) return NextResponse.json({ error: enrollRes.error.message }, { status: 500 })

  const enrollments: { status: string; exit_reason: string | null }[] = enrollRes.data ?? []
  const logs: { event_type: string; metadata: Record<string, unknown> | null }[] = logRes.data ?? []

  const total_enrolled = enrollments.length
  const total_completed = enrollments.filter((e) => e.status === 'completed').length
  const total_active = enrollments.filter((e) => e.status === 'active').length
  const total_exited = enrollments.filter((e) => e.status === 'exited').length

  // Per email step open/click
  const stepMap = new Map<number, { sent: number; opens: number; clicks: number }>()
  for (const log of logs) {
    const idx = (log.metadata as { step_index?: number } | null)?.step_index ?? 0
    const s = stepMap.get(idx) ?? { sent: 0, opens: 0, clicks: 0 }
    if (log.event_type === 'email_sent') s.sent++
    else if (log.event_type === 'opened') s.opens++
    else if (log.event_type === 'clicked') s.clicks++
    stepMap.set(idx, s)
  }

  const emailSteps = Array.from(stepMap.values()).filter((s) => s.sent > 0)
  const avg_open_rate = emailSteps.length > 0
    ? emailSteps.reduce((acc, s) => acc + (s.opens / s.sent) * 100, 0) / emailSteps.length
    : null
  const avg_click_rate = emailSteps.length > 0
    ? emailSteps.reduce((acc, s) => acc + (s.clicks / s.sent) * 100, 0) / emailSteps.length
    : null
  const completion_rate = total_enrolled > 0
    ? Math.round((total_completed / total_enrolled) * 100)
    : null

  return NextResponse.json({
    stats: {
      total_enrolled,
      total_completed,
      total_active,
      total_exited,
      avg_open_rate: avg_open_rate != null ? Math.round(avg_open_rate * 10) / 10 : null,
      avg_click_rate: avg_click_rate != null ? Math.round(avg_click_rate * 10) / 10 : null,
      completion_rate,
    },
  })
}
