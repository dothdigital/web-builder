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
  const oacId = process.env.HOSTING_CLOUDFRONT_OAC_ID ?? ''
  const backend = process.env.HOSTING_PUBLIC_API_URL ?? ''
  const reserved = (process.env.HOSTING_RESERVED_DOMAINS ?? 'webtummy.com').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  const missing = [!bucket && 'HOSTING_S3_BUCKET', !region && 'HOSTING_AWS_REGION', !oacId && 'HOSTING_CLOUDFRONT_OAC_ID', !backend && 'HOSTING_PUBLIC_API_URL'].filter(Boolean) as string[]
  if (backend) { try { const url = new URL(backend); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1'].includes(url.hostname)) missing.push('HOSTING_PUBLIC_API_URL must be a public HTTPS origin') } catch { missing.push('HOSTING_PUBLIC_API_URL must be a public HTTPS origin') } }
  return { bucket, region, oacId, backend: backend.replace(/\/$/, ''), reserved, missing, configured: missing.length === 0 }
}
export function assertHostingConfigured() {
  const config = hostingConfig()
  if (!config.configured) throw new Error('AWS hosting is not configured yet. The platform administrator must complete the hosting setup first.')
  return config
}
export function assertCustomerHostname(hostname: string) {
  const { reserved } = hostingConfig()
  if (reserved.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) throw new Error('This domain is reserved for the platform.')
  if (hostname.endsWith('.cloudfront.net') || hostname.endsWith('.amazonaws.com')) throw new Error('Enter a domain you own, not an AWS service address.')
}
