import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const maxDuration = 30 // seconds

// Gmail SMTP transporter using the same app-password as /api/email/send
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
      to,
      subject,
      html,
    }: {
      to: string[]
      subject: string
      html: string
      templateName?: string
      addPrefix?: boolean
    } = body

    if (!to || !to.length || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 })
    }

    const fromUser = process.env.IMAP_USER
    if (!fromUser || !process.env.IMAP_PASSWORD) {
      return NextResponse.json({ error: 'SMTP credentials not configured' }, { status: 500 })
    }

    // Send to all recipients simultaneously
    await Promise.all(
      to.map((recipient) =>
        transporter.sendMail({
          from: `Andar · Twibbonize <${fromUser}>`,
          to: recipient,
          subject,
          html,
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email/send-test] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
