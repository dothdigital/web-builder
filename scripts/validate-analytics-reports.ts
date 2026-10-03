import assert from 'node:assert/strict'
import vm from 'node:vm'
import { parseGoogleReports } from '../apps/web/src/lib/analytics-reports'
import { websiteTracker } from '../apps/web/src/lib/website-tracker'
async function main() {
const report = parseGoogleReports([
  { rows: [{ metricValues: [{ value: '100' }, { value: '30' }] }] },
  { rows: [{ dimensionValues: [{ value: '20260923' }], metricValues: [{ value: '100' }] }] },
  { rows: [{ dimensionValues: [{ value: '/about' }], metricValues: [{ value: '55' }] }] },
  { rows: [{ dimensionValues: [{ value: 'Canada' }, { value: 'Toronto' }], metricValues: [{ value: '25' }] }] },
  { rows: [{ dimensionValues: [{ value: 'google' }, { value: 'organic' }], metricValues: [{ value: '15' }] }] },
])
assert.equal(report.views, 100)
assert.equal(report.visitors, 30)
assert.equal(report.referrals[0]?.label, 'google / organic')
assert.equal(report.referralMetric, 'Sessions')
assert.equal(parseGoogleReports([]).views, 0)
const sent: Array<{ url: string; body: Blob }> = []
const storage = new Map<string, string>()
const context = vm.createContext({ window: {}, URL, Blob, crypto: { randomUUID: () => crypto.randomUUID() }, localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) }, location: { pathname: '/about', hostname: 'example.com' }, document: { referrer: 'https://search.example/results?private=secret' }, navigator: { sendBeacon: (url: string, body: Blob) => sent.push({ url, body }) } })
vm.runInContext(websiteTracker('project-1', 'https://builder.example/api/visits'), context)
vm.runInContext(websiteTracker('project-1', 'https://builder.example/api/visits'), context)
assert.equal(sent.length, 1, 'One beacon per page load')
const data = JSON.parse(await sent[0]!.body.text())
assert.equal(data.path, '/about')
assert.equal(data.referrer, 'search.example')
assert.ok(!JSON.stringify(data).includes('private'))
assert.equal(data.projectId, 'project-1')
assert.ok(storage.has('awb-visitor'))
console.log('PASS: separate metric mappings, empty data, visitor tracking, referrer query exclusion and duplicate beacon prevention. No external requests.')

}
void main()
