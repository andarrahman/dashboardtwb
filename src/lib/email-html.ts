import type { EmailBlock, MarketingTemplateRow, SocialPlatform, ColumnItem } from '@/lib/supabase/types'

// ─── Social platform config ────────────────────────────────────────────────────

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  tiktok: 'TikTok',
}

const SOCIAL_COLORS: Record<SocialPlatform, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  twitter: '#000000',
  tiktok: '#010101',
}

// SVG paths from Simple Icons (https://simpleicons.org) — viewBox="0 0 24 24"
const SOCIAL_SVG_PATHS: Record<SocialPlatform, string> = {
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  instagram: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  youtube: 'M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z',
  twitter: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
}

// ─── Block → HTML ──────────────────────────────────────────────────────────────

function paddingStyle(block: EmailBlock): string {
  const top = block.paddingTop ?? 8
  const bottom = block.paddingBottom ?? 8
  const left = block.paddingLeft ?? 0
  const right = block.paddingRight ?? 0
  return `padding: ${top}px ${right}px ${bottom}px ${left}px;`
}

function alignStyle(block: EmailBlock): string {
  return `text-align: ${block.alignment ?? 'left'};`
}

export function blockToHtml(block: EmailBlock): string {
  const pad = paddingStyle(block)
  const align = alignStyle(block)

  switch (block.type) {
    case 'heading': {
      const tag = block.headingTag ?? 'h2'
      const tagDefaults: Record<string, number> = { h1: 32, h2: 24, h3: 18 }
      const fontSize = (block.fontSize != null && block.fontSize > 0) ? block.fontSize : (tagDefaults[tag] ?? 24)
      const color = block.color ?? '#1B1B1B'
      return `<${tag} style="${pad} ${align} font-size: ${fontSize}px; font-weight: 700; color: ${color}; margin: 0; line-height: 1.2;">${block.headingText ?? 'Heading'}</${tag}>`
    }

    case 'text': {
      const size = (block.fontSize && block.fontSize > 0) ? `${block.fontSize}px` : '15px'
      const color = block.color ?? '#4B4B4B'
      const content = block.textContent ?? 'Your text here'
      const isHtml = /<[a-z][\s\S]*>/i.test(content)
      // Ensure ul/ol list-style is preserved (Tailwind preflight resets it)
      // Normalize all ul/ol — use block alignment so lists match the text-align setting
      const listAlign = block.alignment ?? 'left'
      // list-style-position:inside keeps bullet/number in flow when center/right aligned
      const listPos = listAlign === 'left' ? 'outside' : 'inside'
      const normalized = content
        .replace(/<ul[^>]*>/g, `<ul style="list-style-type:disc;padding-left:24px;margin:0;text-align:${listAlign};list-style-position:${listPos};">`)
        .replace(/<ol[^>]*>/g, `<ol style="list-style-type:decimal;padding-left:24px;margin:0;text-align:${listAlign};list-style-position:${listPos};">`)
        .replace(/<li[^>]*>/g, `<li style="margin:0;text-align:${listAlign};">`)
      const rendered = isHtml ? normalized : content.replace(/\n/g, '<br>')
      return `<div style="${pad} ${align} font-size: ${size}; color: ${color}; margin: 0; line-height: 1.6;">${rendered}</div>`
    }

    case 'image': {
      const width = block.imageWidth ? `${block.imageWidth}%` : '100%'
      const wrapAlign =
        block.alignment === 'center'
          ? 'margin-left: auto; margin-right: auto;'
          : block.alignment === 'right'
          ? 'margin-left: auto;'
          : ''
      const img = block.imageUrl
        ? `<img src="${block.imageUrl}" alt="${block.imageAlt ?? ''}" style="display: block; width: ${width}; max-width: 100%; height: auto; ${wrapAlign}" />`
        : `<div style="display: block; width: ${width}; ${wrapAlign} background: #F0F0F0; height: 200px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
             <span style="color: #999; font-size: 13px;">Image placeholder</span>
           </div>`
      const inner = block.imageLink
        ? `<a href="${block.imageLink}" style="display: block;">${img}</a>`
        : img
      return `<div style="${pad}">${inner}</div>`
    }

    case 'button': {
      const label = block.buttonLabel ?? 'Click here'
      const url = block.buttonUrl ?? '#'
      const bg = block.buttonBgColor ?? '#16DAC1'
      const color = block.buttonTextColor ?? '#FFFFFF'
      const radius = block.buttonRadius ?? 100
      const wrapAlign =
        block.alignment === 'center'
          ? 'text-align: center;'
          : block.alignment === 'right'
          ? 'text-align: right;'
          : 'text-align: left;'
      return `<div style="${pad} ${wrapAlign}">
        <a href="${url}" style="display: inline-block; background-color: ${bg}; color: ${color}; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: ${radius}px;">${label}</a>
      </div>`
    }

    case 'divider': {
      const color = block.dividerColor ?? '#E5E7EB'
      const thickness = block.dividerThickness ?? 1
      return `<div style="${pad}"><hr style="border: none; border-top: ${thickness}px solid ${color}; margin: 0;" /></div>`
    }

    case 'spacer': {
      const height = block.spacerHeight ?? 24
      return `<div style="height: ${height}px;"></div>`
    }

    case 'social': {
      const links = (block.socialLinks ?? []).filter((l) => l.enabled && l.url)
      const size = block.socialIconSize ?? 36
      const bgColor = block.socialIconBgColor ?? ''
      const iconColor = block.socialIconColor ?? '#FFFFFF'
      const radius = block.socialIconRadius ?? 50
      const wrapAlign =
        block.alignment === 'center'
          ? 'text-align: center;'
          : block.alignment === 'right'
          ? 'text-align: right;'
          : 'text-align: left;'
      if (links.length === 0) {
        return `<div style="${pad} ${wrapAlign} color: #999; font-size: 13px;">No social links enabled</div>`
      }
      const svgSize = Math.round(size * 0.52)
      const icons = links
        .map((l) => {
          const platformColor = bgColor || SOCIAL_COLORS[l.platform as SocialPlatform] || '#555'
          const svgPath = SOCIAL_SVG_PATHS[l.platform as SocialPlatform] ?? ''
          const label = SOCIAL_LABELS[l.platform as SocialPlatform] || l.platform
          const svgIcon = svgPath
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${svgSize}" height="${svgSize}" fill="${iconColor}" style="display:block;"><path d="${svgPath}"/></svg>`
            : `<span style="color:${iconColor};font-size:${Math.round(size * 0.4)}px;font-weight:700;font-family:Arial,sans-serif;">${label.charAt(0).toUpperCase()}</span>`
          return `<a href="${l.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin: 0 4px; text-decoration: none;">
            <div style="width: ${size}px; height: ${size}px; border-radius: ${radius}%; background-color: ${platformColor}; display: inline-flex; align-items: center; justify-content: center; line-height: 0;">
              ${svgIcon}
            </div>
          </a>`
        })
        .join('')
      return `<div style="${pad} ${wrapAlign}">${icons}</div>`
    }

    case 'html': {
      const content = block.htmlContent ?? '<!-- Your custom HTML -->'
      const pad2 = paddingStyle(block)
      return `<div style="${pad2}">${content}</div>`
    }

    case 'columns': {
      const cols = block.columnCount ?? 2
      const gap = block.columnGap ?? 16
      // Support both old columnItems (flat) and new columnStacks (2D)
      const stacks: ColumnItem[][] = block.columnStacks
        ?? (block.columnItems?.map((item: ColumnItem) => [item]) ?? Array.from({ length: cols }, () => []))

      const colWidth = `${Math.floor(100 / cols)}%`

      function columnItemToHtml(item: ColumnItem): string {
        switch (item.type) {
          case 'heading': {
            const tag = item.headingTag ?? 'h2'
            const tagDefaults: Record<string, number> = { h1: 32, h2: 24, h3: 18 }
            const fontSize = (item.fontSize != null && item.fontSize > 0) ? item.fontSize : (tagDefaults[tag] ?? 24)
            const color = item.color ?? '#1B1B1B'
            const align = item.alignment ?? 'left'
            return `<${tag} style="font-size: ${fontSize}px; font-weight: 700; color: ${color}; margin: 0; line-height: 1.2; text-align: ${align};">${item.headingText ?? 'Heading'}</${tag}>`
          }
          case 'text': {
            const size = (item.fontSize && item.fontSize > 0) ? `${item.fontSize}px` : '15px'
            const color = item.color ?? '#4B4B4B'
            const align = item.alignment ?? 'left'
            const content = item.textContent ?? ''
            const isHtml = /<[a-z][\s\S]*>/i.test(content)
            const rendered = isHtml ? content : content.replace(/\n/g, '<br>')
            return `<div style="font-size: ${size}; color: ${color}; margin: 0; line-height: 1.6; text-align: ${align};">${rendered}</div>`
          }
          case 'image': {
            const img = item.imageUrl
              ? `<img src="${item.imageUrl}" alt="${item.imageAlt ?? ''}" style="display: block; width: 100%; max-width: 100%; height: auto;" />`
              : `<div style="width: 100%; background: #F0F0F0; height: 120px; display: flex; align-items: center; justify-content: center;"><span style="color: #999; font-size: 12px;">Image</span></div>`
            return item.imageLink
              ? `<a href="${item.imageLink}" style="display: block;">${img}</a>`
              : img
          }
          case 'button': {
            const label = item.buttonLabel ?? 'Click here'
            const url = item.buttonUrl ?? '#'
            const bg = item.buttonBgColor ?? '#16DAC1'
            const color = item.buttonTextColor ?? '#FFFFFF'
            const align = item.alignment === 'center' ? 'text-align: center;' : item.alignment === 'right' ? 'text-align: right;' : 'text-align: left;'
            return `<div style="${align}"><a href="${url}" style="display: inline-block; background-color: ${bg}; color: ${color}; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 22px; border-radius: 100px;">${label}</a></div>`
          }
          default:
            return ''
        }
      }

      const tds = stacks.map((items, i) => {
        const cellHtml = items.map(item => columnItemToHtml(item)).join('\n')
        const paddingLeft = i === 0 ? '0' : `${gap / 2}px`
        const paddingRight = i === cols - 1 ? '0' : `${gap / 2}px`
        return `<td style="width:${colWidth};vertical-align:top;padding-left:${paddingLeft};padding-right:${paddingRight};">${cellHtml || '&nbsp;'}</td>`
      }).join('\n')

      return `<div style="${pad}"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr>${tds}</tr></tbody></table></div>`
    }

    case 'unsubscribe': {
      const color = block.color ?? '#999999'
      const fontSize = block.fontSize ?? 11
      return `<div style="${pad} text-align: center; font-size: ${fontSize}px; color: ${color}; line-height: 1.6;">
    <a href="{{unsubscribe_url}}" style="color: ${color}; text-decoration: underline;">Unsubscribe</a>
    &nbsp;&middot;&nbsp;
    <a href="{{manage_preferences_url}}" style="color: ${color}; text-decoration: underline;">Manage Preferences</a>
  </div>`
    }

    default:
      return ''
  }
}

// ─── Full email HTML ───────────────────────────────────────────────────────────

export function generateEmailHtml(
  template: MarketingTemplateRow,
  opts?: { bgColor?: string; fontFamily?: string; bodyBgColor?: string; maxWidth?: number; googleFontUrl?: string }
): string {
  const blocksHtml = (template.blocks ?? []).map(block => {
    let html = blockToHtml(block)
    if (block.bgColor) html = `<div style="background-color: ${block.bgColor};">${html}</div>`
    if (block.bgImage) {
      const overlay = block.bgImageOverlay != null ? block.bgImageOverlay : 0
      const overlayHtml = overlay > 0
        ? `<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,${overlay});"></div>`
        : ''
      html = `<div style="background-image:url('${block.bgImage}');background-size:cover;background-position:center;position:relative;">${overlayHtml}<div style="position:relative;z-index:1;">${html}</div></div>`
    }
    if (block.hideOnMobile) return `<div class="email-hide-mobile">${html}</div>`
    if (block.hideOnDesktop) return `<div class="email-hide-desktop">${html}</div>`
    return html
  }).join('\n')
  const bgColor = opts?.bgColor ?? '#F6F6F6'
  const bodyBgColor = opts?.bodyBgColor ?? template.body_bg_color ?? '#FFFFFF'
  const fontFamily = opts?.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  const maxWidth = opts?.maxWidth ?? 600

  const googleFontLinks = opts?.googleFontUrl
    ? `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${opts.googleFontUrl}" rel="stylesheet">`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(template.name)}</title>
${googleFontLinks}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background-color: ${bgColor}; font-family: ${fontFamily}; }
    .email-wrapper { padding: 24px 16px; }
    .email-body { max-width: ${maxWidth}px; margin: 0 auto; background-color: ${bodyBgColor}; border-radius: 8px; overflow: hidden; }
    .email-content { padding: 32px 24px; }
    .email-col-td { display: table-cell !important; }
    .email-hide-mobile { display: block; }
    .email-hide-desktop { display: none; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 0 !important; }
      .email-body { border-radius: 0 !important; width: 100% !important; }
      .email-content { padding: 20px 16px !important; }
      table { width: 100% !important; }
      td { display: block !important; width: 100% !important; padding-right: 0 !important; }
      img { width: 100% !important; height: auto !important; }
      .email-col-td { display: block !important; width: 100% !important; }
      .email-hide-mobile { display: none !important; }
      .email-hide-desktop { display: block !important; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-body">
      <div class="email-content">
        ${blocksHtml}
      </div>
    </div>
  </div>
</body>
</html>`
}

// ─── Canvas-preview HTML (no wrapper, injected into canvas div) ───────────────

export function generateCanvasHtml(blocks: EmailBlock[]): string {
  return blocks.map(blockToHtml).join('\n')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
