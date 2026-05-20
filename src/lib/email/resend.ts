// Email sender — supports Resend (primary) and Gmail SMTP via Nodemailer (fallback)
// Priority: workspace resend_api_key → RESEND_API_KEY env → Gmail SMTP env

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  workspaceId?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string; error?: string }> {
  let fromName = 'Twibbonize'
  let fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_USER ?? 'noreply@twibbonize.com'
  let replyTo = opts.replyTo
  let apiKey = process.env.RESEND_API_KEY

  // Load workspace-level overrides from DB
  if (opts.workspaceId) {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: ws } = await (supabase as any)
      .from('workspace_email_settings')
      .select('from_name, from_email, reply_to, resend_api_key')
      .eq('workspace_id', opts.workspaceId)
      .single()
    if (ws) {
      fromName = (ws.from_name as string | null) ?? fromName
      fromEmail = (ws.from_email as string | null) ?? fromEmail
      replyTo = replyTo ?? (ws.reply_to as string | null) ?? undefined
      apiKey = (ws.resend_api_key as string | null) ?? apiKey
    }
  }

  const from = opts.from ?? `${fromName} <${fromEmail}>`

  // ── Option A: Resend ──────────────────────────────────────────────────────
  if (apiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, reply_to: replyTo }),
    })
    const data = await res.json() as { id?: string; message?: string }
    if (!res.ok) return { error: data?.message ?? 'Resend send failed' }
    return { id: data.id }
  }

  // ── Option B: Gmail SMTP via Nodemailer ───────────────────────────────────
  const smtpUser = process.env.SMTP_USER || process.env.IMAP_USER
  const smtpPass = process.env.SMTP_PASS || process.env.IMAP_PASSWORD

  if (smtpUser && smtpPass) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    })
    try {
      const info = await transporter.sendMail({
        from: opts.from ?? `${fromName} <${smtpUser}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: replyTo,
      })
      return { id: info.messageId }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP send failed'
      console.error('[smtp] Send failed:', msg)
      return { error: msg }
    }
  }

  // ── No provider configured ────────────────────────────────────────────────
  console.warn('[email] No email provider configured. Set RESEND_API_KEY or SMTP_USER + SMTP_PASS.')
  return { error: 'No email provider configured (set RESEND_API_KEY or SMTP_USER/SMTP_PASS)' }
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await (supabase as any).from('email_suppression').select('id').eq('email', email).limit(1).single()
  return !!data
}
