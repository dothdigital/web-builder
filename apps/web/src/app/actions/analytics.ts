'use server'
import { WorkspaceRole, prisma } from '@awb/database'
import { z } from 'zod'
import { requireProject } from '@/lib/tenancy'
import { decryptRecaptchaSecret, encryptRecaptchaSecret } from '@/lib/recaptcha'
import { googleAnalyticsReport, serviceAccountSchema, type AnalyticsReport } from '@/lib/analytics-reports'
import { revalidatePath } from 'next/cache'

export async function connectAnalytics(projectId: string, propertyId: string, json: string) {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  z.string().regex(/^\d{1,20}$/).parse(propertyId)
  if (json.length > 30000) throw new Error('The credentials file is too large.')
  let account: z.infer<typeof serviceAccountSchema>
  try { account = serviceAccountSchema.parse(JSON.parse(json)) } catch { throw new Error('Choose a valid Google service-account JSON file.') }
  // Test read access before replacing a working connection.
  await googleAnalyticsReport(propertyId, account, 7)
  const analyticsCredentials = encryptRecaptchaSecret(JSON.stringify(account), 'analytics')
  await prisma.integration.upsert({ where: { projectId }, create: { projectId, conversionEvents: [], analyticsPropertyId: propertyId, analyticsCredentials }, update: { analyticsPropertyId: propertyId, analyticsCredentials } })
  revalidatePath(`/projects/${projectId}/analytics`)
}
export async function disconnectAnalytics(projectId: string) {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  await prisma.integration.updateMany({ where: { projectId }, data: { analyticsPropertyId: null, analyticsCredentials: null } })
  revalidatePath(`/projects/${projectId}/analytics`)
}
export async function loadAnalytics(projectId: string, source: 'website' | 'google', days: number): Promise<AnalyticsReport> {
  await requireProject(projectId)
  if (![7, 30, 90].includes(days)) throw new Error('Choose 7, 30 or 90 days.')
  if (source === 'google') {
    const integration = await prisma.integration.findUnique({ where: { projectId } })
    if (!integration?.analyticsPropertyId || !integration.analyticsCredentials) throw new Error('Connect Google Analytics to load this report.')
    return googleAnalyticsReport(integration.analyticsPropertyId, JSON.parse(decryptRecaptchaSecret(integration.analyticsCredentials, 'analytics')), days)
  }
  const end = new Date()
  const start = new Date(end); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - days + 1)
  type CountRow = { label: string; value: bigint }
  const [totals, daily, pages, locations, referrals] = await Promise.all([
    prisma.$queryRaw<Array<{ views: bigint; visitors: bigint }>>`SELECT COUNT(*) AS views, COUNT(DISTINCT "visitorHash") AS visitors FROM "WebsiteVisit" WHERE "projectId"=${projectId} AND "occurredAt">=${start} AND "occurredAt"<${end}`,
    prisma.$queryRaw<CountRow[]>`SELECT to_char("occurredAt", 'YYYYMMDD') AS label, COUNT(*) AS value FROM "WebsiteVisit" WHERE "projectId"=${projectId} AND "occurredAt">=${start} AND "occurredAt"<${end} GROUP BY label ORDER BY label`,
    prisma.$queryRaw<CountRow[]>`SELECT "pagePath" AS label, COUNT(*) AS value FROM "WebsiteVisit" WHERE "projectId"=${projectId} AND "occurredAt">=${start} AND "occurredAt"<${end} GROUP BY "pagePath" ORDER BY value DESC LIMIT 20`,
    prisma.$queryRaw<CountRow[]>`SELECT COALESCE("country", 'Unknown') || ' / ' || COALESCE("city", 'Unknown') AS label, COUNT(*) AS value FROM "WebsiteVisit" WHERE "projectId"=${projectId} AND "occurredAt">=${start} AND "occurredAt"<${end} GROUP BY "country", "city" ORDER BY value DESC LIMIT 20`,
    prisma.$queryRaw<CountRow[]>`SELECT referrer AS label, COUNT(*) AS value FROM "WebsiteVisit" WHERE "projectId"=${projectId} AND "occurredAt">=${start} AND "occurredAt"<${end} GROUP BY referrer ORDER BY value DESC LIMIT 20`,
  ])
  const rows = (data: CountRow[]) => data.map((row) => ({ label: row.label, value: Number(row.value) }))
  const dailyMap = new Map(rows(daily).map((row) => [row.label, row.value]))
  return { views: Number(totals[0]?.views ?? 0), visitors: Number(totals[0]?.visitors ?? 0), daily: Array.from({ length: days }, (_, index) => { const date = new Date(start); date.setUTCDate(date.getUTCDate() + index); const label = date.toISOString().slice(0, 10).replaceAll('-', ''); return { label, value: dailyMap.get(label) ?? 0 } }), pages: rows(pages), locations: rows(locations), referrals: rows(referrals), referralMetric: 'Page views' }
}

export async function saveTrackingHost(projectId: string, value: string) {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const hostname = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)) throw new Error('Enter a hostname such as www.example.com, without a path.')
  await prisma.integration.upsert({ where: { projectId }, create: { projectId, conversionEvents: [], analyticsTrackingHost: hostname }, update: { analyticsTrackingHost: hostname } })
  revalidatePath(`/projects/${projectId}/analytics`)
}
