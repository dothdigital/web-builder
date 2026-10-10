import React from 'react'
import dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })
;(globalThis as any).React = React
const { prisma } = await import('@awb/database')
try {
  const { buildStaticExport } = await import('../apps/web/src/lib/static-export')
  const { resolvePreviewAssets } = await import('../apps/web/src/lib/preview-assets')
  const id = 'cmv16xtt2000715nrx0e817em'
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId: id, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const model = await resolvePreviewAssets(id, version.model as any)
  const archive = await buildStaticExport(model, { siteUrl: `https://test-${id}.webtummy.com`, preview: true })
  console.log(JSON.stringify({ export: 'ok', bytes: archive.length }))
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message.replace(/https?:\/\/\S+/g, '[URL redacted]'))
  process.exitCode = 1
} finally { await prisma.$disconnect() }
