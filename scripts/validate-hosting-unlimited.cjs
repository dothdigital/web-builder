const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || require(name), process, URL, Buffer, AbortSignal, fetch })
  return exports
}
const config = load('apps/web/src/lib/hosting/config.ts')
const pool = load('apps/web/src/lib/hosting/pool.ts', { '@awb/database': { prisma: {} }, './config': config })
const server = { id: 'one', apiUrl: 'http://127.0.0.1:9090', originUrl: 'http://127.0.0.1:8081', token: 'x'.repeat(32), enabled: true }
assert.equal(config.parseServerPool(JSON.stringify([server]))[0].id, 'one')
const legacy = { ...server, capacity: 3 }
assert.equal(pool.selectServer([legacy], { one: 3 }).id, 'one')
assert.equal(pool.selectServer([legacy], { one: 1000000 }).id, 'one')
assert.equal(pool.selectServer([legacy, { ...server, id: 'two' }], { one: 1000000, two: 4 }).id, 'two')
assert.equal(pool.selectServer([{ ...legacy, enabled: false }], {}), undefined)
assert.equal(pool.selectServer([], {}), undefined)
assert.throws(() => config.parseServerPool(JSON.stringify([{ ...server, token: 'short' }])))
console.log('PASS: no count cap, legacy capacity ignored, least-loaded selection, disabled/unavailable servers excluded, authentication validation retained.')
const policy = load('packages/database/src/billing-policy.ts')
const billing = load('apps/web/src/lib/billing/access.ts', { '@awb/database': { prisma: {} }, '@awb/database/billing-policy': policy })
const paid = { status: 'ACTIVE', billingExempt: false, billingPlanId: 'plan', billingStatus: 'active', billingPaidThrough: new Date(Date.now() + 86400000), billingPeriodEnd: new Date(Date.now() + 86400000) }
const trial = { ...paid, billingStatus: 'trialing', billingPaidThrough: null, billingTrialEnd: new Date(Date.now() + 86400000) }
assert.equal(billing.paidAccess(trial), true)
assert.equal(billing.publishingAccess(trial), false)
assert.equal(billing.publishingAccess(paid), true)
assert.equal(billing.publishingAccess({ ...paid, billingPaidThrough: null }), false)
assert.equal(billing.publishingAccess({ ...paid, status: 'SUSPENDED' }), false)
assert.equal(billing.publishingAccess({ ...trial, billingTrialEnd: new Date(Date.now() - 86400000) }), false)
assert.equal(billing.publishingAccess({ ...paid, billingStatus: 'past_due' }), false)
assert.equal(billing.publishingAccess({ ...paid, billingExempt: true }), true)
console.log('PASS: trial editing/test access retained; live publishing requires paid active access; expired, unpaid, past-due and suspended customers blocked.')
;(async () => {
  let workspace = trial
  let allocationAttempts = 0
  const service = load('apps/web/src/lib/hosting/service.ts', {
    '@awb/database': { prisma: { project: { findUniqueOrThrow: async () => ({ workspace }) } } },
    '@awb/website-model': {}, '@awb/component-registry': {}, '../preview-assets': {}, '../static-export': {},
    './config': { assertHostingConfigured: () => { allocationAttempts++; throw new Error('passed billing gate') } },
    './dns': {}, './cloudflare': {}, './pool': {}, './storage': {}, './preview': {},
    '@awb/database/billing-policy': policy, '../billing/access': billing,
  })
  await assert.rejects(service.publishSite('test-project', 'test-user'), /active paid subscription/)
  assert.equal(allocationAttempts, 0)
  workspace = paid
  await assert.rejects(service.publishSite('test-project', 'test-user'), /passed billing gate/)
  assert.equal(allocationAttempts, 1)
  console.log('PASS: live publishing service blocks trial before allocating or deploying; paid customers pass the gate.')
})().catch(error => { console.error(error); process.exitCode = 1 })
