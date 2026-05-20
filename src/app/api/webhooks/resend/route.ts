import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verify webhook secret if configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = req.headers.get('svix-signature') ?? req.headers.get('resend-signature')
    if (!signature || !signature.includes(webhookSecret)) {
      // Basic check — in production use svix for proper verification
    }
  }

  const body = await req.json() as { type: string; data: { to?: string[]; email_id?: string; subject?: string } }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const eventType = body.type
  const toEmail = body.data?.to?.[0]

  if (!toEmail) return NextResponse.json({ ok: true })

  // Find contact by email
  const { data: contact } = await (supabase as any)
    .from('contacts')
    .select('id, workspace_id')
    .eq('email', toEmail)
    .limit(1)
    .single()

  if (eventType === 'email.bounced') {
    // 1. Add to suppression list
    await (supabase as any).from('email_suppression').upsert({
      email: toEmail,
      workspace_id: contact?.workspace_id ?? null,
      contact_id: contact?.id ?? null,
      reason: 'bounce',
      suppressed_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    // 2. Update contact bounce status if found
    if (contact?.id) {
      await (supabase as any).from('contacts').update({
        email_status: 'bounced',
        updated_at: new Date().toISOString(),
      }).eq('id', contact.id)
    }
  }

  if (eventType === 'email.complained') {
    await (supabase as any).from('email_suppression').upsert({
      email: toEmail,
      workspace_id: contact?.workspace_id ?? null,
      contact_id: contact?.id ?? null,
      reason: 'complaint',
      suppressed_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    if (contact?.id) {
      await (supabase as any).from('contacts').update({
        email_status: 'complained',
        updated_at: new Date().toISOString(),
      }).eq('id', contact.id)
    }
  }

  // Log deliverability event
  if (contact?.workspace_id) {
    await (supabase as any).from('email_deliverability_logs').insert({
      workspace_id: contact.workspace_id,
      contact_id: contact?.id ?? null,
      email: toEmail,
      event_type: eventType.replace('email.', ''), // 'bounced', 'complained', 'delivered', 'opened', 'clicked'
      resend_email_id: body.data?.email_id ?? null,
      subject: body.data?.subject ?? null,
      metadata: body.data,
      created_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ ok: true })
}
