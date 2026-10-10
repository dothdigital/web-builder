import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'
import JSZip from 'jszip'
import { createHostingAgent } from './agent.mjs'

test('gateway routes to the assigned server and preserves tenant and release isolation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webtummy-pool-'))
  const token = 'test-token-'.repeat(4)
  let origin, gateway
  try {
    origin = await createHostingAgent({ root: join(root, 'origin'), token, originUrl: 'http://origin.internal', adminPort: 0, publicPort: 0 })
    const originUrl = `http://127.0.0.1:${origin.publicServer.address().port}`
    // The origin's own configured name is used in its local manifest. The
    // gateway connects through the loopback address for this integration test.
    gateway = await createHostingAgent({ root: join(root, 'gateway'), token, originUrl: 'http://gateway.internal', peers: { [originUrl]: token }, adminPort: 0, publicPort: 0 })
    const admin = async (instance, path, method, body, authenticated = true) => fetch(`http://127.0.0.1:${instance.admin.address().port}${path}`, { method, headers: authenticated ? { Authorization: `Bearer ${token}` } : {}, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) })
    const visit = (instance, path = '/', host = 'site.customer.com') => new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: instance.publicServer.address().port, path, headers: { host } }, (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => { const value = Buffer.concat(chunks).toString(); resolve({ status: response.statusCode, headers: { get: (key) => response.headers[key] }, text: async () => value, json: async () => JSON.parse(value) }) })
        response.on('error', reject)
      })
      req.on('error', reject); req.end()
    })
    assert.equal((await admin(origin, '/health', 'GET', undefined, false)).status, 401)
    const zip = new JSZip(); zip.file('index.html', 'Website A'); zip.file('assets/style.css', 'body{}')
    const archive = await zip.generateAsync({ type: 'nodebuffer' })
    assert.equal((await admin(origin, '/sites/site-a/releases/release-a', 'PUT', archive)).status, 200)
    const localRoute = { projectId: 'site-a', releaseId: 'release-a', hosts: ['site.customer.com', 'preview.customer.com'], primary: 'site.customer.com', suspended: false, originUrl: 'http://origin.internal' }
    assert.equal((await admin(origin, '/sites/site-a/activate', 'POST', localRoute)).status, 200)
    const route = { ...localRoute, originUrl }
    assert.equal((await admin(gateway, '/routes/site-a', 'PUT', route)).status, 200)
    assert.equal(await (await visit(gateway)).text(), 'Website A')
    assert.equal((await visit(gateway, '/', 'unknown.customer.com')).status, 404)
    const redirect = await visit(gateway, '/about?ref=pool', 'preview.customer.com')
    assert.equal(redirect.status, 308)
    assert.equal(redirect.headers.get('location'), 'https://site.customer.com/about?ref=pool')
    assert.deepEqual(await (await visit(gateway, '/.well-known/webtummy-release')).json(), { projectId: 'site-a', releaseId: 'release-a' })
    assert.equal((await admin(gateway, '/routes/site-a', 'PUT', { ...route, releaseId: 'missing-release' })).status, 200)
    // Verification must fail when gateway and origin disagree on the release.
    // The platform checks the returned release ID against the requested one.
    assert.equal((await (await visit(gateway, '/.well-known/webtummy-release')).json()).releaseId, 'release-a')
    assert.equal((await admin(gateway, '/routes/site-a', 'PUT', { ...route, suspended: true })).status, 200)
    assert.equal((await visit(gateway)).status, 503)
    assert.equal((await admin(gateway, '/routes/site-b', 'PUT', { ...route, projectId: 'site-b' })).status, 400)
    assert.equal((await admin(origin, '/sites/site-b/releases/release-a', 'PUT', archive)).status, 200)
    assert.equal((await admin(origin, '/sites/site-b/activate', 'POST', { ...localRoute, projectId: 'site-b' })).status, 400)
    assert.equal((await admin(origin, '/sites/site-a/activate', 'POST', { ...localRoute, releaseId: 'missing' })).status, 400)
    // Draft previews have a separate namespace and never replace the live site.
    const previewZip = new JSZip(); previewZip.file('index.html', 'Draft preview')
    const previewArchive = await previewZip.generateAsync({ type: 'nodebuffer' })
    const previewRoute = { ...localRoute, projectId: 'site-a_preview', releaseId: 'preview-a', hosts: ['test.customer.com'], primary: 'test.customer.com', preview: true }
    assert.equal((await admin(origin, '/sites/site-a_preview/releases/preview-a', 'PUT', previewArchive)).status, 200)
    assert.equal((await admin(origin, '/sites/site-a_preview/activate', 'POST', previewRoute)).status, 200)
    assert.equal((await admin(gateway, '/routes/site-a_preview', 'PUT', { ...previewRoute, originUrl })).status, 200)
    const preview = await visit(gateway, '/', 'test.customer.com')
    assert.equal(preview.status, 200)
    assert.equal(await preview.text(), 'Draft preview')
    assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow')
    assert.equal((await admin(gateway, '/routes/site-a', 'PUT', route)).status, 200)
    assert.equal(await (await visit(gateway)).text(), 'Website A')
    assert.equal((await admin(gateway, '/routes/site-a_preview', 'PUT', { ...previewRoute, originUrl, suspended: true })).status, 200)
    assert.equal((await visit(gateway, '/', 'test.customer.com')).status, 503)
    assert.equal(await (await visit(gateway)).text(), 'Website A')
  } finally {
    await gateway?.close(); await origin?.close()
    await rm(root, { recursive: true, force: true })
  }
})
