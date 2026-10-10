import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@awb/database'
import { hostingConfig } from '@/lib/hosting/config'
import { syncHosting, withHostingLock } from '@/lib/hosting/service'
import { syncPreview } from '@/lib/hosting/preview'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function POST(request: Request) {
  const secret = process.env.HOSTING_CRON_SECRET
  const received = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!secret || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return new Response(null, { status: 401 })
  if (!hostingConfig().configured) return Response.json({ error: 'Hosting is not configured.' }, { status: 503 })
  const sites = await prisma.hostingSite.findMany({ where: { OR: [{ status: 'PROVISIONING' }, { pendingReleaseId: { not: null } }, { previewPendingReleaseId: { not: null } }, { project: { domains: { some: {} } } }] }, orderBy: { updatedAt: 'asc' }, take: 10, select: { projectId: true } })
  const results = []
  for (const site of sites) {
    try { await withHostingLock(site.projectId, async () => { await syncPreview(site.projectId); await syncHosting(site.projectId) }); results.push({ projectId: site.projectId, ok: true }) }
    catch { results.push({ projectId: site.projectId, ok: false }) }
  }
  return Response.json({ checked: results }, { headers: { 'Cache-Control': 'no-store' } })
}
