import { prisma } from '@awb/database'
import { assertHostingConfigured, type HostingServer } from './config'

export async function agent<T>(server: HostingServer, path: string, method = 'GET', body?: unknown, timeoutMs = 120000): Promise<T> {
  const archive = Buffer.isBuffer(body)
  const response = await fetch(`${server.apiUrl}${path}`, { method, headers: { Authorization: `Bearer ${server.token}`, 'Content-Type': archive ? 'application/zip' : 'application/json' }, body: body === undefined ? undefined : archive ? new Uint8Array(body as Buffer) : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', redirect: 'error' })
  if (!response.ok) throw new Error('Hosting server request failed')
  return response.json() as Promise<T>
}
export function assignedServer(id: string | null) {
  const server = assertHostingConfigured().servers.find((server) => server.id === id)
  if (!server) throw new Error('Hosting server assignment is unavailable. Contact the platform administrator.')
  return server
}
export function selectServer(servers: HostingServer[], counts: Record<string, number>) {
  return servers.filter((server) => server.enabled && (counts[server.id] ?? 0) < server.capacity).sort((a, b) => (counts[a.id] ?? 0) / a.capacity - (counts[b.id] ?? 0) / b.capacity || a.id.localeCompare(b.id))[0]
}
export async function allocateServer(projectId: string) {
  const config = assertHostingConfigured()
  const current = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  if (current.serverId) return assignedServer(current.serverId)
  // Probe in parallel before taking the allocation lock; offline servers must
  // not hold up allocations for other projects.
  const probes = await Promise.all(config.servers.filter((server) => server.enabled).map(async (server) => {
    try {
      const health = await agent<{ ok?: boolean }>(server, '/health', 'GET', undefined, 5000)
      return health.ok === true ? server : null
    } catch { return null }
  }))
  const healthy = probes.filter((server): server is HostingServer => server !== null)
  // Serialize capacity allocation across processes and different projects.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(87120419)`
    const site = await tx.hostingSite.findUniqueOrThrow({ where: { projectId } })
    if (site.serverId) return assignedServer(site.serverId)
    const groups = await tx.hostingSite.groupBy({ by: ['serverId'], _count: { _all: true } })
    const counts = Object.fromEntries(groups.filter((group) => group.serverId).map((group) => [group.serverId!, group._count._all]))
    const server = selectServer(healthy, counts)
    if (!server) throw new Error('Hosting capacity is unavailable. Contact the platform administrator.')
    await tx.hostingSite.update({ where: { projectId }, data: { serverId: server.id, publicHost: `${projectId}.${config.previewDomain}`, status: 'READY' } })
    return server
  }, { timeout: 10000, maxWait: 10000 })
}
export type RouteManifest = { projectId: string; releaseId: string; hosts: string[]; primary: string; suspended: boolean; originUrl: string; preview?: boolean }
export async function activateRoutes(server: HostingServer, route: RouteManifest) {
  const config = assertHostingConfigured()
  await agent(server, `/sites/${route.projectId}/activate`, 'POST', route)
  // Shared fallback gateways route domains to their assigned hosting server.
  for (const id of config.gatewayIds) await agent(assignedServer(id), `/routes/${route.projectId}`, 'PUT', route)
}
export async function releaseIsLive(server: HostingServer, projectId: string, releaseId: string) {
  const state = await agent<{ releaseId?: string }>(server, `/sites/${projectId}`)
  if (state.releaseId !== releaseId) return false
  for (const id of assertHostingConfigured().gatewayIds) {
    const state = await agent<{ releaseId?: string }>(assignedServer(id), `/routes/${projectId}`)
    if (state.releaseId !== releaseId) return false
  }
  return true
}
export async function checkPublicRelease(hostname: string, projectId: string, releaseId: string) {
  try {
    const response = await fetch(`https://${hostname}/.well-known/webtummy-release?check=${Date.now()}`, { signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store' })
    if (!response.ok) return false
    const result = await response.json() as { projectId?: string; releaseId?: string }
    return result.projectId === projectId && result.releaseId === releaseId
  } catch { return false }
}
