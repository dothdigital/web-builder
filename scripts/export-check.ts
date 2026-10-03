import { writeFile } from 'node:fs/promises'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { resolvePreviewAssets } from '../apps/web/src/lib/preview-assets'
import { buildStaticExport } from '../apps/web/src/lib/static-export'

async function main(): Promise<void> {
  const projectId = process.argv[2]

  if (!projectId) {
    throw new Error('usage: export-check <projectId>')
  }

  const version = await prisma.websiteVersion.findFirstOrThrow({
    where: { projectId },
    orderBy: { version: 'desc' },
  })

  const model = websiteModelSchema.parse(version.model)
  const archive = await buildStaticExport(await resolvePreviewAssets(projectId, model), { siteUrl: 'https://example.com' })

  await writeFile('/tmp/site-export.zip', archive)
  console.log('bytes', archive.byteLength, 'pages', model.pages.length)
}

void main().finally(() => prisma.$disconnect())
