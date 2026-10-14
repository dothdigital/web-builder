import { Resolver } from 'node:dns/promises'

function createResolver(server?: string) {
  const resolver = new Resolver({ timeout: 4000, tries: 2 })
  if (server) resolver.setServers([server])
  return resolver
}
const resolver = createResolver()
const fallbackResolvers = [createResolver('8.8.8.8'), createResolver('1.1.1.1')]

async function queryDomainDns(resolver: Resolver, hostname: string, token: string, target?: string | null) {
  let ownership = false
  let routing = false
  try { ownership = !!token && (await resolver.resolveTxt(`_awb-verification.${hostname}`)).some((parts) => parts.join('') === token) } catch { /* DNS still pending. */ }
  if (target) {
    try { routing = (await resolver.resolveCname(hostname)).some((name) => name.replace(/\.$/, '').toLowerCase() === target.replace(/\.$/, '').toLowerCase()) } catch { /* Apex ALIAS records flatten to addresses. */ }
    if (!routing) {
      try { const [actual, expected] = await Promise.all([resolver.resolve4(hostname), resolver.resolve4(target)]); routing = actual.length > 0 && actual.every((ip) => expected.includes(ip)) } catch { /* Routing still pending. */ }
    }
  }
  return { ownership, routing }
}

export async function checkDomainDns(hostname: string, token: string, target?: string | null) {
  const primary = await queryDomainDns(resolver, hostname, token, target)
  if (primary.ownership && (!target || primary.routing)) return primary
  // Newly saved records can remain negatively cached by the server resolver.
  // Every resolver must still return the exact ownership token or routing target.
  const fallback = await Promise.all(fallbackResolvers.map(resolver => queryDomainDns(resolver, hostname, token, target)))
  return {
    ownership: primary.ownership || fallback.some(result => result.ownership),
    routing: primary.routing || fallback.some(result => result.routing),
  }
}
