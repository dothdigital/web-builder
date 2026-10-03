import 'dotenv/config'
import { config } from 'dotenv'
config({ override: true, quiet: true })
import { prisma, AssetKind, AssetSource } from '@awb/database'
import { OpenAiProvider } from '@awb/ai'
import { assetKey, getStorage } from '@awb/shared'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent } from '@awb/component-registry'

// Run only after approval for the real AI requests and new draft.
async function main() {
  const projectId = process.argv[2]
  if (!projectId) throw new Error('Provide a project ID')
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  if (project.status === 'GENERATING') throw new Error('Generation is already running')
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const model = websiteModelSchema.parse(version.model)
  const missing = model.pages.filter((page) => !page.sections.some((section) => section.props.imageUrl))
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ project: project.name, version: version.version, pagesForAiMenu: model.pages.map(({ path, title }) => ({ path, title })), missingImages: missing.map((page) => page.path) }, null, 2))
    return
  }
  const provider = new OpenAiProvider({ apiKey: process.env.OPENAI_API_KEY! })
  const storage = getStorage()
  const { data, usage } = await provider.planNavigation(model.pages.map(({ path, title }) => ({ path, title })))
  model.navigation.primaryMenu = data.navigation.map((item) => ({ label: item.label, pageId: model.pages.find((page) => page.path === item.path)!.id, linkType: 'PAGE', newTab: false, children: item.children.map((child) => ({ label: child.label, pageId: model.pages.find((page) => page.path === child.path)!.id, linkType: 'PAGE', newTab: false, children: [] })) }))
  model.globalComponents.header.props.items = data.navigation.map((item) => ({ label: item.label, href: item.path, children: item.children.map((child) => ({ label: child.label, href: child.path })) }))
  console.log('AI menu:', usage.model, data.navigation.map((item) => `${item.label} (${item.children.length})`).join(', '))
  for (let offset = 0; offset < missing.length; offset += 2) {
    await Promise.all(missing.slice(offset, offset + 2).map(async (page) => {
      const hero = page.sections.find((section) => getComponent(section.componentId)?.family === 'HERO')
      if (!hero) throw new Error(`Missing hero on ${page.path}`)
      const prompt = `Professional editorial website photograph about ${page.title} for ${model.site.name}. Warm natural light, appropriate subjects and a scene relevant to the supplied business context. No text, logos, watermarks or claims. Context: ${page.seo.description}`
      const { data: image } = await provider.generateImage(prompt, '16:10', `${page.id}:${hero.id}:/imageUrl`, `${page.title} at ${model.site.name}`)
      const stored = await storage.put(assetKey(project.workspaceId, projectId, `${page.id}-hero.png`), image.data, image.contentType)
      await prisma.asset.create({ data: { workspaceId: project.workspaceId, projectId, kind: AssetKind.IMAGE, source: AssetSource.AI_GENERATED, storageKey: stored.key, url: stored.url, bytes: stored.bytes, mimeType: stored.contentType, prompt, altText: image.alt } })
      hero.props.imageUrl = stored.url
      hero.props.imageAlt = image.alt
      console.log('Added image:', page.path)
    }))
  }
  await prisma.$transaction(async (tx) => {
    const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
    if (latest.id !== version.id) throw new Error('Website changed during repair; preserved current version')
    await tx.websiteVersion.create({ data: { projectId, version: version.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'AI-organized navigation and missing page imagery' } })
  })
  console.log(`Saved draft v${version.version + 1}: ${missing.length} missing page images repaired`)
}
main().finally(() => prisma.$disconnect())
