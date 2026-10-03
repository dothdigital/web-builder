import { Resolver } from 'node:dns/promises'
const resolver = new Resolver({ timeout: 4000, tries: 2 })
export async function checkDomainDns(hostname: string, token: string, target?: string | null) {
  let ownership = false
  let routing = false
  try { ownership = (await resolver.resolveTxt(`_awb-verification.${hostname}`)).some((parts) => parts.join('') === token) } catch { /* DNS still pending. */ }
  if (target) {
    try { routing = (await resolver.resolveCname(hostname)).some((name) => name.replace(/\.$/, '').toLowerCase() === target.toLowerCase()) } catch { /* Apex ALIAS records flatten to addresses. */ }
    if (!routing) {
      try { const [actual, expected] = await Promise.all([resolver.resolve4(hostname), resolver.resolve4(target)]); routing = actual.length > 0 && actual.every((ip) => expected.includes(ip)) } catch { /* Routing still pending. */ }
    }
  }
  return { ownership, routing }
}
