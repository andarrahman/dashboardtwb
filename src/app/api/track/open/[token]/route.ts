import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeToken } from '@/lib/email/tracking'

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

// Known bot/proxy User-Agent patterns — these cause false opens
const BOT_UA_PATTERNS = [
  /googleimageproxy/i,
  /google image proxy/i,
  /googlebot/i,
  /yahoo.*mail/i,
  /yahoomail/i,
  /outlook\.com/i,
  /preview/i,
  /thunderbird/i,     // some Thunderbird builds pre-fetch
  /libwww-perl/i,
  /python-requests/i,
  /curl\//i,
  /wget\//i,
  /\bbot\b/i,
  /\bcrawler\b/i,
  /\bspider\b/i,
]

function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return false
  return BOT_UA_PATTERNS.some((p) => p.test(ua))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = decodeToken(token)
  const userAgent = req.headers.get('user-agent')

  // Return pixel immediately — always — but skip logging for known bots/proxies
  if (payload && !isBotUserAgent(userAgent)) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get workspace_id from automation
    const { data: automation } = await (supabase as any)
      .from('email_automations')
      .select('workspace_id')
      .eq('id', payload.automationId)
      .single()

    if (automation) {
      // Deduplicate: only log if no prior 'opened' event for this enrollment+step
      const { count } = await (supabase as any)
        .from('automation_logs')
        .select('id', { count: 'exact', head: true })
        .eq('automation_id', payload.automationId)
        .eq('contact_id', payload.contactId)
        .eq('event_type', 'opened')
        .eq('metadata->>step_index', String(payload.stepIndex))

      if ((count ?? 0) === 0) {
        await (supabase as any).from('automation_logs').insert({
          automation_id: payload.automationId,
          workspace_id: automation.workspace_id,
          contact_id: payload.contactId,
          event_type: 'opened',
          event_label: 'Email opened',
          description: `Step ${payload.stepIndex + 1} email opened`,
          metadata: { enrollment_id: payload.enrollmentId, step_index: payload.stepIndex },
        })
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache' },
  })
}
