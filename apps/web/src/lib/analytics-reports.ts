import { JWT } from 'google-auth-library'
import { z } from 'zod'

export const serviceAccountSchema = z.object({ type: z.literal('service_account'), client_email: z.string().email(), private_key: z.string().min(100).max(20000) })
export type AnalyticsReport = { views: number; visitors: number; daily: Array<{ label: string; value: number }>; pages: Array<{ label: string; value: number }>; locations: Array<{ label: string; value: number }>; referrals: Array<{ label: string; value: number }>; referralMetric: string }
type Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }
type Report = { rows?: Row[] }
export function parseGoogleReports(reports: Report[]): AnalyticsReport {
  const rows = (index: number) => (reports[index]?.rows ?? []).map((row) => ({ label: row.dimensionValues?.map((entry) => entry.value || '(unknown)').join(' / ') ?? '', value: Number(row.metricValues?.[0]?.value ?? 0) }))
  return { views: Number(reports[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0), visitors: Number(reports[0]?.rows?.[0]?.metricValues?.[1]?.value ?? 0), daily: rows(1), pages: rows(2), locations: rows(3), referrals: rows(4), referralMetric: 'Sessions' }
}
export async function googleAnalyticsReport(propertyId: string, credentials: unknown, days: number) {
  if (!/^\d+$/.test(propertyId) || ![7, 30, 90].includes(days)) throw new Error('Invalid report settings.')
  const account = serviceAccountSchema.parse(credentials)
  try {
    const client = new JWT({ email: account.client_email, key: account.private_key, scopes: ['https://www.googleapis.com/auth/analytics.readonly'] })
    const token = await client.getAccessToken()
    const request = (dimensions: string[], metrics: string[], limit = 20) => ({ dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit, orderBys: dimensions[0] === 'date' ? [{ dimension: { dimensionName: 'date' } }] : dimensions.length ? [{ metric: { metricName: metrics[0] }, desc: true }] : [] })
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, { method: 'POST', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [request([], ['screenPageViews', 'totalUsers']), request(['date'], ['screenPageViews'], 90), request(['pagePath'], ['screenPageViews']), request(['country', 'city'], ['screenPageViews']), request(['sessionSource', 'sessionMedium'], ['sessions'])] }), signal: AbortSignal.timeout(20000), cache: 'no-store' })
    if (!response.ok) throw new Error('Google API unavailable')
    const body = await response.json() as { reports: Report[] }
    if (body.reports?.length !== 5) throw new Error('Incomplete response')
    return parseGoogleReports(body.reports)
  } catch { throw new Error('Could not load Google Analytics. Check the property ID, service-account Viewer access, and that the Analytics Data API is enabled.') }
}
