import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — load workspace email settings
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get workspace for this user
  const { data: membership } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const { data: settings } = await (supabase as any)
    .from('workspace_email_settings')
    .select('from_name, from_email, reply_to, resend_api_key, resend_webhook_secret')
    .eq('workspace_id', membership.workspace_id)
    .single()

  return NextResponse.json({ settings: settings ?? null, workspaceId: membership.workspace_id })
}

// PATCH — upsert workspace email settings
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get workspace for this user
  const { data: membership } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const body = await req.json() as {
    from_name?: string
    from_email?: string
    reply_to?: string
    resend_api_key?: string
    resend_webhook_secret?: string
  }

  const { error } = await (supabase as any)
    .from('workspace_email_settings')
    .upsert({
      workspace_id: membership.workspace_id,
      from_name: body.from_name ?? 'Twibbonize',
      from_email: body.from_email ?? 'noreply@twibbonize.com',
      reply_to: body.reply_to ?? null,
      resend_api_key: body.resend_api_key ?? null,
      resend_webhook_secret: body.resend_webhook_secret ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
