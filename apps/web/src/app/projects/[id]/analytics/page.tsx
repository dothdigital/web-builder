import Link from 'next/link'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProject } from '@/lib/tenancy'
import { loadAnalytics } from '@/app/actions/analytics'
import { AnalyticsConnection, TrackingHost, RefreshReport } from './connection'
import type { AnalyticsReport } from '@/lib/analytics-reports'
export const dynamic = 'force-dynamic'

function Breakdown({ title, rows, metric = 'Page views' }: { title: string; rows: AnalyticsReport['pages']; metric?: string }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value))
  return <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">{title}</h2>{!rows.length ? <p className="text-sm text-neutral-500">No data for this period.</p> : <table className="w-full text-sm"><thead><tr className="text-left text-neutral-500"><th className="pb-2 font-normal">{title}</th><th className="pb-2 text-right font-normal">{metric}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td className="max-w-xs break-words py-2 pr-4">{row.label}<div className="mt-1 h-1 rounded bg-sky-100"><div className="h-1 rounded bg-sky-600" style={{ width: `${row.value / maximum * 100}%` }} /></div></td><td className="text-right tabular-nums">{row.value.toLocaleString()}</td></tr>)}</tbody></table>}</section>
}
export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ source?: string; days?: string }> }) {
  const { id } = await params
  const { project, role } = await requireProject(id)
  const search = await searchParams
  const source = search.source === 'google' ? 'google' : 'website'
  const days = [7, 30, 90].includes(Number(search.days)) ? Number(search.days) : 30
  const integration = await prisma.integration.findUnique({ where: { projectId: id }, select: { analyticsPropertyId: true, analyticsTrackingHost: true } })
  let report: AnalyticsReport | undefined
  let error = ''
  if (source === 'website' || integration?.analyticsPropertyId) {
    try { report = await loadAnalytics(id, source, days) } catch (problem) { error = source === 'google' && problem instanceof Error ? problem.message : 'Could not load website traffic. Please retry.' }
  }
  const dateLabel = (value: string) => /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value
  const maximum = Math.max(1, ...report?.daily.map((entry) => entry.value) ?? [])
  return <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
    <Link href="/dashboard" className="text-sm text-sky-700">← Websites</Link>
    <header><h1 className="text-2xl font-semibold">{project.name} · Analytics</h1><p className="mt-1 text-sm text-neutral-500">Page views, visitors, locations and referrals. {source === 'website' ? 'Includes today; refresh to see new visits.' : 'Google reports cover completed days through yesterday.'}</p></header>
    <div className="flex flex-wrap justify-between gap-3"><RefreshReport /><nav className="flex gap-2" aria-label="Analytics source">{([['website', 'Website traffic'], ['google', 'Google Analytics']] as const).map(([key, label]) => <Link key={key} aria-current={source === key ? 'page' : undefined} className={`rounded-lg border px-4 py-2 text-sm ${source === key ? 'bg-neutral-900 text-white' : 'bg-white'}`} href={`?source=${key}&days=${days}`}>{label}</Link>)}</nav><nav className="flex gap-2" aria-label="Date range">{[7, 30, 90].map((range) => <Link key={range} className={`rounded-lg border px-3 py-2 text-sm ${range === days ? 'bg-sky-100 text-sky-800' : ''}`} href={`?source=${source}&days=${range}`} aria-current={range === days ? 'page' : undefined}>{range} days</Link>)}</nav></div>
    {source === 'google' && role !== WorkspaceRole.VIEWER && <AnalyticsConnection projectId={id} propertyId={integration?.analyticsPropertyId} />}
    {source === 'google' && !integration?.analyticsPropertyId && <p className="rounded-lg bg-sky-50 p-4 text-sm">Connect a GA4 property to show real Google Analytics data. A measurement ID alone cannot read reports.</p>}
    {source === 'website' && role !== WorkspaceRole.VIEWER && <TrackingHost projectId={id} hostname={integration?.analyticsTrackingHost} />}
    {source === 'website' && <p className="rounded-lg bg-sky-50 p-4 text-sm">Direct counts come from the tracking code in new website exports. Deploy a new export from a public builder URL and register the website’s domain with this project. Editor and preview visits are excluded. Visitors are browser identifiers, not identified people. Location is available on Vercel hosting; other hosts show Unknown. Dates use UTC.</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {report && <>
      <div className="grid gap-4 sm:grid-cols-2">{[['Page views (hits)', report.views], ['Visitors', report.visitors]].map(([label, value]) => <section key={label} className="rounded-xl border bg-white p-5"><p className="text-sm text-neutral-500">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{Number(value).toLocaleString()}</p></section>)}</div>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Daily page views</h2>{report.views === 0 ? <p className="py-8 text-sm text-neutral-500">No visits recorded in this period yet.</p> : <><svg role="img" aria-label="Daily page views chart; hover a bar for its date and count" viewBox="0 0 900 230" className="mt-4 w-full">{report.daily.map((entry, index) => { const width = 900 / Math.max(1, report!.daily.length); const height = entry.value / maximum * 210; return <rect key={entry.label} x={index * width + 1} y={220 - height} width={Math.max(1, width - 2)} height={Math.max(1, height)} fill="#0284c7" rx="2"><title>{dateLabel(entry.label)}: {entry.value} page views</title></rect> })}</svg><div className="flex justify-between text-xs text-neutral-500"><span>{dateLabel(report.daily[0]?.label ?? '')}</span><span>{dateLabel(report.daily.at(-1)?.label ?? '')}</span></div><details className="mt-3 text-sm"><summary>Daily values</summary><table className="mt-2 w-full"><tbody>{report.daily.map((row) => <tr key={row.label}><td>{dateLabel(row.label)}</td><td className="text-right">{row.value}</td></tr>)}</tbody></table></details></>}</section>
      <div className="grid gap-4 lg:grid-cols-3"><Breakdown title="Top pages" rows={report.pages} /><Breakdown title="Locations" rows={report.locations} /><Breakdown title="Referral sources" rows={report.referrals} metric={report.referralMetric} /></div>
      <p className="text-xs text-neutral-500">Website and Google totals may differ due to blockers, browser storage, attribution and processing delays. Tables show the top 20 results.</p>
    </>}
  </main>
}
