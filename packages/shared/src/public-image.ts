import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

export function publicImageAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
  }
  if (isIP(address) === 6) {
    const [a, b] = address.toLowerCase().split(':')
    const first = parseInt(a || '0', 16), second = parseInt(b || '0', 16)
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff && !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
  }
  return false
}

// Resolve and pin each connection, including redirects, to prevent DNS rebinding.
export async function readPublicImage(input: string): Promise<{ bytes: Buffer; contentType: string }> {
  let url = new URL(input)
  const deadline = Date.now() + 20000
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Only public HTTP images are allowed')
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    let timer: ReturnType<typeof setTimeout> | undefined
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Image lookup timed out')), Math.max(1, Math.min(3000, deadline - Date.now()))) }),
    ]).finally(() => clearTimeout(timer))
    if (!addresses.length || addresses.some(entry => !publicImageAddress(entry.address))) throw new Error('Image must resolve to a public address')
    const address = addresses[0]!
    const result = await new Promise<{ bytes: Buffer; contentType: string; redirect?: string }>((resolve, reject) => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) { reject(new Error('Image timed out')); return }
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        family: address.family, lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: { Accept: 'image/*', 'Accept-Encoding': 'identity', 'User-Agent': 'Webtummy-Image/1.0' },
      }, response => {
        const status = response.statusCode ?? 500
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          resolve({ bytes: Buffer.alloc(0), contentType: '', redirect: response.headers.location }); response.destroy(); return
        }
        const contentType = (response.headers['content-type'] || '').split(';')[0]!.trim().toLowerCase()
        if (status < 200 || status >= 300 || !/^image\/(png|jpeg|webp|avif|gif|svg\+xml|x-icon|vnd.microsoft.icon)$/.test(contentType) || Number(response.headers['content-length'] || 0) > 5 * 1024 * 1024) {
          response.destroy(); reject(new Error('Image is unavailable or too large')); return
        }
        let length = 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => { length += chunk.length; if (length > 5 * 1024 * 1024) { response.destroy(new Error('Image is too large')); return }; chunks.push(chunk) })
        response.on('end', () => length ? resolve({ bytes: Buffer.concat(chunks), contentType }) : reject(new Error('Empty image')))
        response.on('error', reject)
      })
      const timeout = setTimeout(() => request.destroy(new Error('Image timed out')), remaining)
      request.on('error', reject)
      request.on('close', () => clearTimeout(timeout))
      request.end()
    })
    if (!result.redirect) return result
    url = new URL(result.redirect, url)
  }
  throw new Error('Too many image redirects')
}
