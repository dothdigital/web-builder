import { createHmac } from 'node:crypto'
import { prisma } from '@awb/database'
import { z } from 'zod'
export const runtime = 'nodejs'
const visitSchema = z.object({ id: z.string().uuid(), projectId: z.string().max(100), visitor: z.string().uuid(), path: z.string().startsWith('/').max(500), referrer: z.string().max(253).regex(/^[a-zA-Z0-9.:-]*$/) })
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 2048) return new Response(null, { status: 413 })
  const text = await request.text()
  if (text.length > 2048) return new Response(null, { status: 413 })
  let input: z.infer<typeof visitSchema>
  try { input = visitSchema.parse(JSON.parse(text)) } catch { return new Response(null, { status: 400 }) }
  const origin = request.headers.get('origin')
  let host: string
  try { host = new URL(origin ?? '').hostname.toLowerCase() } catch { return new Response(null, { status: 403 }) }
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, include: { hosting: { select: { distributionHost: true } }, integration: { select: { analyticsTrackingHost: true } }, domains: { where: { verifiedAt: { not: null } }, select: { hostname: true } } } })
  if (!project) return new Response(null, { status: 404 })
  const allowed = [project.previewHost, ...(project.hosting?.distributionHost ? [project.hosting.distributionHost] : []), ...(project.integration?.analyticsTrackingHost ? [project.integration.analyticsTrackingHost] : []), ...project.domains.map((domain) => domain.hostname)].map((value) => value.toLowerCase())
  if (!allowed.includes(host)) return new Response(null, { status: 403 })
  const secret = process.env.AUTH_SECRET
  if (!secret) return new Response(null, { status: 503 })
  const visitorHash = createHmac('sha256', secret).update(`${input.projectId}:${input.visitor}`).digest('hex')
  // Bound bursts from the same browser. Never persist visitor IP addresses.
  const recent = await prisma.websiteVisit.count({ where: { projectId: input.projectId, visitorHash, occurredAt: { gte: new Date(Date.now() - 60000) } } })
  if (recent >= 30) return new Response(null, { status: 429 })
  const geo = (name: string) => { const value = request.headers.get(name); if (!value) return null; try { return decodeURIComponent(value).slice(0, 100) } catch { return null } }
  // These geo headers are trusted only on Vercel, which supplies them at its edge.
  await prisma.websiteVisit.upsert({ where: { id: input.id }, update: {}, create: { id: input.id, projectId: input.projectId, visitorHash, pagePath: input.path.split(/[?#]/)[0]!, referrer: input.referrer || 'Direct / internal', country: process.env.VERCEL === '1' ? geo('x-vercel-ip-country') : null, city: process.env.VERCEL === '1' ? geo('x-vercel-ip-city') : null } })
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
