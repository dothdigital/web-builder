import sanitize from 'sanitize-html'
import { cleanFullEmailHtml, fullEmailPlainText } from './email-html'
import { emailSocialIconUrl, emailSocialNames, emailSocialUrl } from './email-social'
import { emailDesignSchema, escapeEmailHtml as escape, emailUrl, type EmailDesign } from './email-design'
const color = [/^#[a-f\d]{3,8}$/i, /^rgb\([\d\s,.]+\)$/]
export function cleanEmailRichText(html: string) {
  return sanitize(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: { span: ['style'], a: ['href', 'style'], p: ['style'] },
    allowedStyles: { '*': { color, 'background-color': color, 'font-size': [/^\d{1,2}px$/], 'font-family': [/^(Arial|Verdana|Tahoma|Trebuchet MS|Georgia|Times New Roman|Courier New)$/], 'font-weight': [/^(bold|normal|[1-9]00)$/], 'font-style': [/^(italic|normal)$/], 'text-decoration': [/^(underline|line-through|none)$/], 'text-align': [/^(left|center|right)$/] } },
    transformTags: { div: 'p', a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...(emailUrl(attrs.href ?? '') ? { href: attrs.href ?? '' } : {}), ...(attrs.style ? { style: attrs.style } : {}) } }) },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'], allowProtocolRelative: false,
  })
}
export function cleanEmailDesign(input: unknown): EmailDesign {
  const design = emailDesignSchema.parse(input)
  if (new Set(design.blocks.map(b => b.id)).size !== design.blocks.length) throw new Error('Email blocks must have unique IDs.')
  if (design.mode === 'html') { design.sourceHtml = cleanFullEmailHtml(design.sourceHtml); return design }
  for (const block of design.blocks) {
    block.html = cleanEmailRichText(block.html)
    if (new Set(block.socialLinks.map(link => link.platform)).size !== block.socialLinks.length) throw new Error('Email social icons must not repeat the same platform.')
    if (block.socialLinks.some(link => !emailSocialUrl(link.href))) throw new Error('Use a valid HTTP or HTTPS address for each social profile.')
    if (!emailUrl(block.src, true) || !emailUrl(block.href)) throw new Error('Use a valid HTTPS image URL and a web, email or telephone link.')
  }
  return design
}
export function emailDesignText(input: unknown) {
  const design = cleanEmailDesign(input)
  if (design.mode === 'html') return fullEmailPlainText(design.sourceHtml)
  return design.blocks.map(b => b.type === 'social' ? b.socialLinks.filter(link => link.href).map(link => `${emailSocialNames[link.platform]}: ${link.href}`).join('\n') : b.type === 'image' ? b.alt : b.type === 'button' ? `${b.label}${b.href ? `: ${b.href}` : ''}` : sanitize(b.html.replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, '\n'), { allowedTags: [], allowedAttributes: {} })).filter(Boolean).join('\n\n') || 'View this email in an HTML-compatible email client.'
}
export function renderEmailDesign(input: unknown, values: Record<string, string>, base: string, address: string, unsubscribe: string, includeFooter = true) {
  const design = cleanEmailDesign(input)
  const interpolate = (text: string) => text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => escape(values[key] ?? `{{${key}}}`))
  if (design.mode === 'html') {
    let html = cleanFullEmailHtml(interpolate(design.sourceHtml))
    // Only explicitly supported app-owned images can be relative. Make them public in emails.
    html = html.replace(/(src|background)="(\/(?:uploads|api\/email-images)\/[^"]*)"/gi, (_match, name: string, path: string) => `${name}="${escape(base)}${path}"`)
    const footer = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff"><tr><td style="padding:24px;font:12px/1.6 Arial,sans-serif;color:#586174;text-align:center">Webtummy<br>${escape(address).replace(/\n/g, '<br>')}<br><br><a href="${escape(unsubscribe)}" style="color:#586174">Unsubscribe from onboarding and promotional emails</a></td></tr></table>`
    return includeFooter ? html.replace(/<\/body>/i, `${footer}</body>`) : html
  }
  const rows = design.blocks.map(block => {
    if (block.type === 'social' && !block.socialLinks.some(link => link.href)) return ''
    const style = `background-color:${block.background};padding:${block.padding}px;text-align:${block.align};font-family:${block.font},sans-serif;font-size:${block.fontSize}px;line-height:1.6;color:${block.color}`
    const href = interpolate(escape(block.href))
    let content = ''
    if (block.type === 'text' || block.type === 'heading') content = `<div style="margin:0;${block.type === 'heading' ? 'font-weight:bold;' : ''}">${cleanEmailRichText(interpolate(block.html))}</div>`
    if (block.type === 'image' && block.src) {
      const src = block.src.startsWith('/') ? `${base}${block.src}` : block.src
      content = `<img src="${escape(src)}" alt="${interpolate(escape(block.alt))}" width="${Math.round((design.width - block.padding * 2) * block.width / 100)}" style="display:inline-block;width:${block.width}%;max-width:100%;height:auto;border:0;border-radius:${block.radius}px">`
      if (href) content = `<a href="${href}">${content}</a>`
    }
    if (block.type === 'button') content = `<a href="${href || escape(base + '/dashboard')}" style="display:inline-block;background-color:${block.fill};color:${block.color};font-family:${block.font},sans-serif;font-size:${block.fontSize}px;text-decoration:none;padding:12px 24px;border-radius:${block.radius}px;max-width:100%;box-sizing:border-box">${interpolate(escape(block.label))}</a>`
    if (block.type === 'social') {
      content = block.socialLinks.filter(link => link.href).map(link => {
        const src = base + emailSocialIconUrl(link.platform, link.color ?? block.color)
        return `<a href="${escape(link.href)}" title="${emailSocialNames[link.platform]}" style="display:inline-block;text-decoration:none;margin:0 ${block.iconGap / 2}px ${block.iconGap / 2}px;vertical-align:middle"><img src="${escape(src)}" alt="${emailSocialNames[link.platform]}" width="${block.iconSize}" height="${block.iconSize}" style="display:block;border:0;width:${block.iconSize}px;height:${block.iconSize}px"></a>`
      }).join('')
    }
    if (block.type === 'divider') content = `<table role="presentation" width="100%"><tr><td style="border-top:1px solid ${block.color};font-size:1px">&nbsp;</td></tr></table>`
    if (block.type === 'spacer') content = `<div style="height:${block.height}px;font-size:1px;line-height:1px">&nbsp;</div>`
    return `<tr><td style="${style}">${content}</td></tr>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${design.background}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${design.background}"><tr><td align="center" style="padding:24px 8px"><table role="presentation" width="${design.width}" cellspacing="0" cellpadding="0" style="width:100%;max-width:${design.width}px;background:${design.contentBackground}">${rows}${includeFooter ? `<tr><td style="padding:24px;font:12px/1.6 Arial,sans-serif;color:#586174;background:#ffffff">Webtummy<br>${escape(address).replace(/\n/g, '<br>')}<br><br><a href="${escape(unsubscribe)}" style="color:#586174">Unsubscribe from onboarding and promotional emails</a></td></tr>` : ''}</table></td></tr></table></body></html>`
}
