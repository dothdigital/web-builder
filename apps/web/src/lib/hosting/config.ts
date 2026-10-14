import { domainToASCII } from 'node:url'
import { isIP } from 'node:net'

export function normalizeHostname(value: string) {
  const input = value.trim().toLowerCase().replace(/\.$/, '')
  if (/[\s/:*?#@\\]/.test(input)) throw new Error('Enter a public domain name without https://, a path, port or wildcard.')
  const hostname = domainToASCII(input)
  if (!hostname || hostname.length > 253 || isIP(hostname) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname) || /\.(localhost|local|internal|test|invalid|example)$/.test(hostname)) throw new Error('Enter a public domain name without https://, a path, port or wildcard.')
  return hostname
}
export function hostingConfig() {
  const bucket = process.env.HOSTING_S3_BUCKET ?? ''
  const region = process.env.HOSTING_AWS_REGION ?? ''
  const backend = process.env.HOSTING_PUBLIC_API_URL ?? ''
  const zoneId = process.env.CLOUDFLARE_ZONE_ID ?? ''
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? ''
  const cnameTarget = process.env.HOSTING_CNAME_TARGET ?? ''
  const previewDomain = process.env.HOSTING_PREVIEW_DOMAIN ?? ''
  const reserved = (process.env.HOSTING_RESERVED_DOMAINS ?? 'webtummy.com').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  const missing = [!bucket && 'HOSTING_S3_BUCKET', !region && 'HOSTING_AWS_REGION', !zoneId && 'CLOUDFLARE_ZONE_ID', !apiToken && 'CLOUDFLARE_API_TOKEN', !cnameTarget && 'HOSTING_CNAME_TARGET', !previewDomain && 'HOSTING_PREVIEW_DOMAIN', !backend && 'HOSTING_PUBLIC_API_URL'].filter(Boolean) as string[]
  for (const host of [cnameTarget, previewDomain]) { if (host) try { if (normalizeHostname(host) !== host) missing.push('Hosting domains must be normalized') } catch { missing.push('Invalid hosting domain') } }
  let servers: HostingServer[] = []
  try { servers = parseServerPool(process.env.HOSTING_SERVERS_JSON ?? '[]') } catch { missing.push('HOSTING_SERVERS_JSON is invalid') }
  const gatewayIds = (process.env.HOSTING_GATEWAY_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  if (!servers.length) missing.push('HOSTING_SERVERS_JSON')
  if (!gatewayIds.length || gatewayIds.some((id) => !servers.some((server) => server.id === id))) missing.push('HOSTING_GATEWAY_IDS')
  if (previewDomain && !reserved.includes(previewDomain)) reserved.push(previewDomain)
  if (cnameTarget && !reserved.includes(cnameTarget)) reserved.push(cnameTarget)
  if (backend) { try { const url = new URL(backend); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1'].includes(url.hostname)) missing.push('HOSTING_PUBLIC_API_URL must be a public HTTPS origin') } catch { missing.push('HOSTING_PUBLIC_API_URL must be a public HTTPS origin') } }
  return { bucket, region, zoneId, apiToken, cnameTarget, previewDomain, servers, gatewayIds, backend: backend.replace(/\/$/, ''), reserved, missing, configured: missing.length === 0 }
}
export type HostingServer = { id: string; apiUrl: string; originUrl: string; token: string; capacity: number; enabled: boolean }
export function parseServerPool(value: string): HostingServer[] {
  const input: unknown = JSON.parse(value)
  if (!Array.isArray(input)) throw new Error('Invalid pool')
  const ids = new Set<string>()
  return input.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid server')
    const server = entry as HostingServer
    if (!/^[a-zA-Z0-9_-]+$/.test(server.id) || ids.has(server.id) || typeof server.token !== 'string' || server.token.length < 32 || !Number.isInteger(server.capacity) || server.capacity < 1 || typeof server.enabled !== 'boolean') throw new Error('Invalid server')
    ids.add(server.id)
    for (const value of [server.apiUrl, server.originUrl]) {
      const url = new URL(value)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid server URL')
      // HTTP is allowed only for private VPC traffic or local testing.
      if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname)) throw new Error('Private HTTP only')
    }
    return { ...server, apiUrl: server.apiUrl.replace(/\/$/, ''), originUrl: server.originUrl.replace(/\/$/, '') }
  })
}
export function assertHostingConfigured() {
  const config = hostingConfig()
  if (!config.configured) throw new Error('Hosting is not configured yet. The platform administrator must connect Cloudflare and the hosting server pool first.')
  return config
}
export function assertCustomerHostname(hostname: string) {
  const { reserved } = hostingConfig()
  if (reserved.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) throw new Error('This domain is reserved for the platform.')
  if (hostname.endsWith('.cloudfront.net') || hostname.endsWith('.amazonaws.com')) throw new Error('Enter a domain you own, not an AWS service address.')
}
