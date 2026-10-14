const assert = require('node:assert/strict')
const Module = require('node:module')
const original = Module._load
let mode = 'stale', calls = 0
class Resolver {
  setServers(servers) { this.server = servers[0] }
  async resolveTxt() { calls++; if (mode === 'stale' && !this.server) throw Object.assign(new Error(), { code: 'ENOTFOUND' }); return [[mode === 'wrong' ? 'wrong-token' : 'webtummy-', mode === 'wrong' ? '' : 'correct']] }
  async resolveCname() { return [mode === 'wrong' ? 'wrong.example.com' : 'sites.webtummy.com.'] }
  async resolve4(name) { return mode === 'wrong' ? (name === 'sites.webtummy.com' ? ['192.0.2.1'] : ['192.0.2.2']) : ['192.0.2.1'] }
}
Module._load = function(name, ...args) { return name === 'node:dns/promises' ? { Resolver } : original.call(this, name, ...args) }
const { checkDomainDns } = require('../apps/web/src/lib/hosting/dns.ts')
Module._load = original
;(async () => {
  assert.deepEqual(await checkDomainDns('example.com', 'webtummy-correct', 'sites.webtummy.com'), { ownership: true, routing: true })
  assert.equal(calls, 3, 'A stale local result triggers both public resolvers')
  mode = 'wrong'
  assert.deepEqual(await checkDomainDns('example.com', 'webtummy-correct', 'sites.webtummy.com'), { ownership: false, routing: false }, 'Fallback cannot accept wrong tokens or destinations')
  mode = 'ready'; calls = 0
  assert.deepEqual(await checkDomainDns('example.com', 'webtummy-correct', 'sites.webtummy.com'), { ownership: true, routing: true })
  assert.equal(calls, 1, 'Already verified DNS avoids fallback requests')
  console.log('DNS fallback passed: stale caches recover, split TXT tokens match, wrong records stay blocked.')
})().catch(error => { console.error(error); process.exitCode = 1 })
