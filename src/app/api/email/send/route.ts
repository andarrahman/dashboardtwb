import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Allow larger payloads (inline images can be large)
export const maxDuration = 30 // seconds

// Gmail SMTP transporter using the same app-password as checkdailyemail.py
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD,
  },
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      threadId,
      messageId,
      workspaceId,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments,
    }: {
      threadId: string
      messageId: string
      workspaceId: string
      to: string
      cc?: string[]
      bcc?: string[]
      subject: string
      text: string
      html?: string | null
      attachments?: { name: string; mime_type: string; content: string }[]
    } = body

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 })
    }

    const fromUser = process.env.IMAP_USER
    if (!fromUser || !process.env.IMAP_PASSWORD) {
      return NextResponse.json({ error: 'SMTP credentials not configured' }, { status: 500 })
    }

    // Build nodemailer attachments from base64 content
    const mailAttachments = (attachments ?? []).map((att) => ({
      filename: att.name,
      content: Buffer.from(att.content ?? '', 'base64'),
      contentType: att.mime_type || 'application/octet-stream',
    }))

    // ── 1. Actually send the email via Gmail SMTP ──────────────────────────
    const info = await transporter.sendMail({
      from: `Andar · Twibbonize <${fromUser}>`,
      to,
      cc:  cc?.join(', ')  || undefined,
      bcc: bcc?.join(', ') || undefined,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
      attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
    })

    // ── 2. Mark thread + message as sent in DB ─────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const now = new Date().toISOString()

    await Promise.all([
      supabase
        .from('email_threads')
        .update({ status: 'sent', last_message_at: now, updated_at: now })
        .eq('id', threadId)
        .eq('workspace_id', workspaceId),
      supabase
        .from('email_messages')
        .update({ sent_at: now, updated_at: now })
        .eq('id', messageId),
    ])

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email/send] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
