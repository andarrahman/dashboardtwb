import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a date, return the Monday (week_start) of that week.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day) // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Given a week_start (Monday), return the Sunday (week_end) of that week.
 */
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6) // +6 days → Sunday
  d.setUTCHours(23, 59, 59, 999)
  return d
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// ── GET /api/projects/[id]/weekly-updates?workspace_id= ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

  const { data: updates, error } = await (supabase as any)
    .from('project_weekly_updates')
    .select('*')
    .eq('project_id', projectId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('week_start', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updates })
}

// ── POST /api/projects/[id]/weekly-updates ────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const body = await req.json()
  const {
    workspace_id,
    status,
    result,
    concern,
    plus,
    minus,
    is_draft,
    // Allow caller to override week (useful for back-filling)
    week_start_override,
  } = body

  if (!workspace_id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })
  if (result === undefined || result === null) {
    return NextResponse.json({ error: 'result is required' }, { status: 400 })
  }

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const now        = new Date()
  const weekStart  = week_start_override
    ? new Date(week_start_override)
    : getWeekStart(now)
  const weekEnd    = getWeekEnd(weekStart)

  // edit window closes at Sunday 23:59:59 of the current week
  const editWindowClosesAt = new Date(weekEnd)

  const isDraft     = is_draft ?? true
  const submittedAt = isDraft ? null : now.toISOString()

  const insertPayload: Record<string, unknown> = {
    project_id:            projectId,
    workspace_id,
    week_start:            toDateString(weekStart),
    week_end:              toDateString(weekEnd),
    status:                status  ?? 'on_track',
    result:                result  ?? '',
    concern:               concern ?? null,
    plus:                  plus    ?? null,
    minus:                 minus   ?? null,
    submitted_by:          user.id,
    submitted_by_name:     userName,
    submitted_at:          submittedAt,
    is_draft:              isDraft,
    edit_window_closes_at: editWindowClosesAt.toISOString(),
  }

  const { data: update, error } = await (supabase as any)
    .from('project_weekly_updates')
    .insert(insertPayload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ update }, { status: 201 })
}
