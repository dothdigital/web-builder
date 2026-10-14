// Run the customer's failed snapshot through the exact production renderer.
// Read-only: no release upload, activation, payments or email delivery.
require('dotenv').config({ quiet: true })
global.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { prisma } = require('@awb/database')
const { resolvePreviewAssets } = require('../apps/web/src/lib/preview-assets.ts')
const { hostingConfig } = require('../apps/web/src/lib/hosting/config.ts')
async function run() {
  try {
    const projectId = 'cmv16xtt2000715nrx0e817em'
    const release = await prisma.publishRelease.findFirstOrThrow({ where: { projectId, isPreview: false, status: 'FAILED' }, orderBy: { createdAt: 'desc' } })
    const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
    const model = await resolvePreviewAssets(projectId, release.snapshot)
    const app = require('../apps/web/.next/server/app/projects/[id]/publishing/page.js')
    const chunks = path.resolve('apps/web/.next/server/chunks')
    let renderer
    for (const file of fs.readdirSync(chunks).filter(file => file.endsWith('.js'))) {
      const text = fs.readFileSync(path.join(chunks, file), 'utf8')
      if (!text.includes('renderToStaticMarkup') || !text.includes('__AWB_EXPORT_ROOT__')) continue
      const chunk = require(path.join(chunks, file))
      for (const [id, implementation] of Object.entries(chunk.modules ?? {})) {
        const source = implementation.toString()
        if (!source.includes('renderToStaticMarkup') || !source.includes('__AWB_EXPORT_ROOT__')) continue
        const entry = await app.__next_app__.require(Number(id))
        assert.equal(Object.keys(entry).length, 1, 'Static export module should export one function')
        renderer = Object.values(entry)[0]
      }
    }
    assert.equal(typeof renderer, 'function', 'Find the compiled static exporter')
    const archive = await renderer(model, { siteUrl: `https://${site.publicHost}`, forms: { projectId, action: `${hostingConfig().backend}/api/leads` } })
    assert.ok(archive.length > 1000)
    console.log(JSON.stringify({ productionExport: 'ok', projectId, bytes: archive.length }))
  } catch (error) {
    console.error(JSON.stringify({ productionExport: 'failed', name: error.name, message: String(error.message).replace(/https?:\/\/\S+/g, '[URL redacted]') }))
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
}
run()
