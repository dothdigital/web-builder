import sanitize from 'sanitize-html'
import juice from 'juice'
import postcss from 'postcss'
import { decodeHTML } from 'entities'
import { emailUrl } from './email-design'

// Email CSS only: no remote stylesheets, executable CSS, positioned overlays or URL fetches.
const properties = ['color', 'background', 'background-color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align', 'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-width', 'border-style', 'border-radius', 'border-collapse', 'border-spacing', 'table-layout', 'display', 'float', 'clear', 'box-sizing', 'list-style-type', 'opacity', 'overflow', 'mso-table-lspace', 'mso-table-rspace']
const safeValue = /^(?!.*(?:url\s*\(|expression\s*\(|javascript|behavior|var\s*\())[\w\s#.,%()'"/+\-!]+$/i
const allowedStyles = { '*': Object.fromEntries(properties.map(property => [property, [safeValue]])) }
function safeStylesheet(css: string) {
  try {
    const root = postcss.parse(decodeHTML(css))
    root.walkAtRules(rule => { if (rule.name.toLowerCase() !== 'media' || !/^[\w\s():.,\-/]+$/.test(rule.params)) rule.remove() })
    root.walkComments(comment => { comment.remove() })
    root.walkRules(rule => { if (/[<>@{}\\]/.test(rule.selector)) rule.remove() })
    root.walkDecls(declaration => { if (!properties.includes(declaration.prop.toLowerCase()) || !safeValue.test(declaration.value)) declaration.remove() })
    return root.toString()
  } catch { return '' }
}
function sanitiseDocument(source: string) {
  return sanitize(source, {
    allowedTags: ['html', 'head', 'body', 'title', 'style', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col', 'div', 'section', 'article', 'header', 'footer', 'main', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sup', 'sub', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'center'],
    allowedAttributes: { '*': ['id', 'class', 'style', 'align', 'valign', 'dir', 'lang', 'role', 'title', 'aria-label'], table: ['width', 'height', 'cellpadding', 'cellspacing', 'border', 'bgcolor', 'background'], td: ['width', 'height', 'colspan', 'rowspan', 'bgcolor', 'background'], th: ['width', 'height', 'colspan', 'rowspan', 'bgcolor'], col: ['width', 'span'], colgroup: ['width', 'span'], body: ['bgcolor'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'border'], ol: ['start'], li: ['value'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'], allowProtocolRelative: false, allowedStyles,
    allowVulnerableTags: true, // style is parsed and restricted by safeStylesheet, then inlined by Juice.
    nonTextTags: ['script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'svg', 'math', 'form'],
    textFilter: (text, tagName) => tagName === 'style' ? safeStylesheet(text) : text,
    transformTags: { '*': (tagName, attributes) => {
      const attrs = { ...attributes }
      if (attrs.href && !emailUrl(attrs.href)) delete attrs.href
      for (const name of ['src', 'background']) if (attrs[name] && !emailUrl(attrs[name]!, true)) delete attrs[name]
      if (tagName === 'a') attrs.rel = 'noopener noreferrer'
      return { tagName, attribs: attrs }
    } },
  })
}
export function cleanFullEmailHtml(source: string) {
  if (!source.trim() || source.length > 150000) throw new Error('Email HTML must contain a template of at most 150,000 characters.')
  const safe = sanitiseDocument(source)
  let inlined: string
  try { inlined = juice(safe, { removeStyleTags: true, preserveMediaQueries: true, preserveFontFaces: false, preserveKeyFrames: false, preservePseudos: false, applyStyleTags: true, applyWidthAttributes: true, applyHeightAttributes: true }) }
  catch { throw new Error('Email HTML could not be read. Check the HTML and CSS syntax.') }
  const result = sanitiseDocument(inlined)
  const head = result.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const body = result.match(/<body([^>]*)>([\s\S]*?)<\/body>/i)
  const content = body?.[2] ?? result.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<\/?html[^>]*>/gi, '')
  if (!sanitize(content, { allowedTags: ['img'], allowedAttributes: {} }).trim()) throw new Error('Email HTML needs visible text or an image.')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body${body?.[1] ?? ''}>${content}</body></html>`
}
export function fullEmailPlainText(source: string) {
  const content = source.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<br\s*\/?\s*>|<\/(p|div|h[1-6]|li|tr|section)>/gi, '\n')
  return decodeHTML(sanitize(content, { allowedTags: [], allowedAttributes: {} })).replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim() || 'View this email in an HTML-compatible email client.'
}
