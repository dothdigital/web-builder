import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import sanitizeHtml from 'sanitize-html'
import { normalizeReferenceUrl, type DesignReference, type ReferenceObservation } from '@awb/shared/design-reference'

// References are read by a worker. Resolve and pin every request, including redirects;
// no cookies, browser execution, subresources or credentials are forwarded.
export function publicReferenceAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 0 && c === 2))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
  }
  if (isIP(address) === 6) {
    const parts = address.toLowerCase().split(':')
    const first = parseInt(parts[0] || '0', 16)
    const second = parseInt(parts[1] || '0', 16)
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) && first !== 0x3fff
  }
  return false
}

export async function readReferenceHtml(input: string): Promise<string> {
  let url = new URL(normalizeReferenceUrl(input))
  const deadline = Date.now() + 15_000
  for (let redirects = 0; redirects <= 3; redirects++) {
    url = new URL(normalizeReferenceUrl(url.href))
    let timer: ReturnType<typeof setTimeout> | undefined
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Reference lookup timed out')), Math.max(1, Math.min(3000, deadline - Date.now()))) }),
    ]).finally(() => clearTimeout(timer))
    if (!addresses.length || addresses.some(entry => !publicReferenceAddress(entry.address))) throw new Error('Reference must resolve to a public website')
    const address = addresses[0]!
    const result = await new Promise<{ html: string; redirect?: string }>((resolve, reject) => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) { reject(new Error('Reference timed out')); return }
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        method: 'GET', family: address.family,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: { Accept: 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'Webtummy-DesignReference/1.0' },
      }, response => {
        const status = response.statusCode ?? 500
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          resolve({ html: '', redirect: response.headers.location }); response.destroy(); return
        }
        if (status < 200 || status >= 300 || !/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers['content-type'] || '')) { response.destroy(); reject(new Error('Reference did not return a public HTML page')); return }
        let length = 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => { length += chunk.length; if (length > 1_500_000) { response.destroy(new Error('Reference page is too large')); return }; chunks.push(chunk) })
        response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }))
        response.on('error', reject)
      })
      const timeout = setTimeout(() => request.destroy(new Error('Reference timed out')), remaining)
      request.on('error', reject)
      request.on('close', () => clearTimeout(timeout))
      request.end()
    })
    if (!result.redirect) return result.html
    url = new URL(result.redirect, url)
  }
  throw new Error('Too many reference redirects')
}

export function observeReferenceHtml(html: string, mode: DesignReference['mode']): ReferenceObservation {
  // Keep a bounded structural description. Never send scripts or raw HTML to AI.
  const layoutHints = new Set<string>()
  const counts = { sections: 0, articles: 0, images: 0, navigationLinks: 0 }
  const styleText: string[] = []
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) styleText.push(match[1]!.slice(0, 80_000))
  const clean = sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'nav', 'a'], allowedAttributes: {},
    transformTags: { '*': (tagName, attribs) => {
      if (tagName === 'section') counts.sections++
      if (tagName === 'article') counts.articles++
      if (tagName === 'img') counts.images++
      if (attribs.style) styleText.push(attribs.style.slice(0, 1000))
      for (const hint of ['grid', 'flex', 'slider', 'carousel', 'hero', 'portfolio', 'award', 'testimonial', 'sticky', 'full-width', 'split']) if (`${attribs.class || ''} ${attribs.style || ''}`.toLowerCase().includes(hint)) layoutHints.add(hint)
      return { tagName, attribs: {} }
    } },
  })
  const text = (value: string) => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim().slice(0, 160)
  let subheadings = 0
  const headings = [...clean.matchAll(/<h([123])>([\s\S]*?)<\/h[123]>/g)].filter(match => match[1] !== '3' || subheadings++ < 6).slice(0, 32).map(match => text(match[2]!))
  counts.navigationLinks = [...clean.matchAll(/<nav>([\s\S]*?)<\/nav>/g)].reduce((sum, match) => sum + (match[1]!.match(/<a>/g)?.length || 0), 0)
  const styles = styleText.join('\n').slice(0, 160_000)
  const colors = [...new Set(styles.match(/#[\da-f]{3,8}\b/gi) || [])].slice(0, 12)
  const fonts = [...new Set([...styles.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map(match => match[1]!.replace(/[<>]/g, '').slice(0, 120)))].slice(0, 6)
  if (!headings.length && counts.images === 0 && counts.sections === 0) throw new Error('No usable page structure')
  return { status: 'read', message: 'Reference structure read. Original content and images will be created for your business; this is design inspiration, not an exact copy.', ...(mode !== 'style' ? { structure: { headings, ...counts, layoutHints: [...layoutHints] } } : {}), ...(mode !== 'layout' ? { style: { colors, fonts } } : {}) }
}

export async function inspectDesignReference(reference: DesignReference): Promise<ReferenceObservation> {
  try { return observeReferenceHtml(await readReferenceHtml(reference.url), reference.mode) }
  catch { return { status: 'unavailable', message: 'The reference could not be read. Generation will use your business brief and design notes instead.' } }
}
