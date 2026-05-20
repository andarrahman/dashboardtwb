// Encode/decode tracking tokens
export interface TrackingPayload {
  enrollmentId: string
  contactId: string
  automationId: string
  stepIndex: number
  url?: string  // for click tracking
}

export function encodeToken(payload: TrackingPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeToken(token: string): TrackingPayload | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as TrackingPayload
  } catch {
    return null
  }
}

export interface InjectTrackingOptions {
  enrollmentId: string
  contactId: string
  automationId: string
  stepIndex: number
  appUrl: string
}

export function injectTracking(html: string, opts: InjectTrackingOptions): string {
  const openToken = encodeToken({
    enrollmentId: opts.enrollmentId,
    contactId: opts.contactId,
    automationId: opts.automationId,
    stepIndex: opts.stepIndex,
  })
  const pixelUrl = `${opts.appUrl}/api/track/open/${openToken}`
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`

  // Wrap links with click tracking
  const withLinks = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url: string) => {
    if (url.includes('/api/track/') || url.includes('/unsubscribe')) return match
    const clickToken = encodeToken({
      enrollmentId: opts.enrollmentId,
      contactId: opts.contactId,
      automationId: opts.automationId,
      stepIndex: opts.stepIndex,
      url,
    })
    return `href="${opts.appUrl}/api/track/click/${clickToken}"`
  })

  // Inject pixel before </body>
  if (withLinks.includes('</body>')) {
    return withLinks.replace('</body>', `${pixel}</body>`)
  }
  return withLinks + pixel
}
