import { getDomain } from 'tldts'

// Use the public suffix list so example.co.uk is treated as a root domain.
export function dnsRecordNames(hostname: string) {
  const zone = getDomain(hostname, { allowPrivateDomains: true }) ?? hostname
  const routingHost = hostname === zone ? '@' : hostname.slice(0, -(zone.length + 1))
  const ownershipHost = routingHost === '@' ? '_awb-verification' : `_awb-verification.${routingHost}`
  return { zone, routingHost, ownershipHost, isRoot: hostname === zone }
}

export function relativeDnsName(name: string, zone: string) {
  const normalized = name.replace(/\.$/, '')
  if (normalized === zone) return '@'
  return normalized.endsWith(`.${zone}`) ? normalized.slice(0, -(zone.length + 1)) : normalized
}
