import dotenv from 'dotenv'
import { createHash } from 'node:crypto'
dotenv.config({ path: '.env', quiet: true })
const { prisma } = await import('@awb/database')
const { createAiProvider } = await import('@awb/ai')
const { assetKey, getStorage } = await import('@awb/shared')
const { emptyImagePointers } = await import('@awb/component-registry')
const [projectId, pagePath, sectionId] = process.argv.slice(2)
if (!projectId || !pagePath || !sectionId) throw new Error('Usage: fill-option-images PROJECT_ID PAGE_PATH SECTION_ID')
try {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { businessProfile: true } })
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const model = version.model as any
  const page = model.pages.find((p: any) => p.path === pagePath)
  const section = page?.sections.find((s: any) => s.id === sectionId)
  if (!section) throw new Error('Section not found')
  const pointers = emptyImagePointers(section.componentId, section.props).filter(pointer => /^\/items\/\d+\/imageUrl$/.test(pointer))
  if (!pointers.length) { console.log('Option images are already filled.'); process.exit(0) }
  const provider = createAiProvider()
  if (provider.name !== 'openai') throw new Error('Real image generation must be configured')
  const slots = pointers.map(pointer => {
    const owner = section.props.items[Number(pointer.split('/')[2])]
    return { slot: `${page.id}:${section.id}:${pointer}`, pageTitle: page.title, heading: section.props.heading, componentId: section.componentId, family: 'SERVICES', subjectContext: JSON.stringify({ imageOwner: owner, section: section.props }) }
  })
  const business = project.businessProfile
  const { data: plan } = await provider.planImages({ businessName: business?.displayName ?? project.name, description: business?.description ?? '', services: [], goals: [], tonePreferences: business?.tone ? [business.tone] : [], answers: {}, hasLogo: true, logoColors: [], uploadedImageUrls: [], testimonials: [] }, model, slots)
  const updates: Array<{ index: number; title: string; description?: string; url: string; alt: string }> = []
  for (const slot of slots) {
    const imagePlan = plan.images.find(image => image.slot === slot.slot)
    if (!imagePlan) throw new Error('Image plan omitted an option')
    const index = Number(slot.slot.split(':')[2]!.split('/')[2])
    const item = section.props.items[index]
    const id = `option-${createHash('sha256').update(`${version.id}:${slot.slot}`).digest('hex').slice(0, 32)}`
    let asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) {
      console.log(`Generating distinct image: ${item.title}`)
      const { data: image } = await provider.generateImage(imagePlan.prompt, imagePlan.aspectRatio, slot.slot, imagePlan.alt)
      const stored = await getStorage().put(assetKey(project.workspaceId, projectId, `${sectionId}-${index}.png`), image.data, image.contentType)
      asset = await prisma.asset.create({ data: { id, projectId, workspaceId: project.workspaceId, kind: 'IMAGE', source: 'AI_GENERATED', storageKey: stored.key, url: stored.url, mimeType: stored.contentType, bytes: stored.bytes, altText: image.alt, prompt: image.prompt } })
    }
    updates.push({ index, title: item.title, description: item.description, url: asset.url, alt: asset.altText ?? item.title })
  }
  await prisma.$transaction(async tx => {
    const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
    const current = JSON.parse(JSON.stringify(latest.model))
    const currentPage = current.pages.find((p: any) => p.path === pagePath)
    const currentSection = currentPage?.sections.find((s: any) => s.id === sectionId)
    if (!currentSection) throw new Error('Section changed during generation')
    for (const update of updates) {
      const item = currentSection.props.items[update.index]
      if (!item || item.title !== update.title || item.description !== update.description || item.imageUrl) throw new Error('An option changed during generation; saved content was left untouched')
      item.imageUrl = update.url
      item.imageAlt = update.alt
    }
    const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
    await tx.websiteVersion.create({ data: { projectId, kind: 'DRAFT', version: last.version + 1, schemaVersion: latest.schemaVersion, model: current, note: 'Distinct images for product preparation options' } })
    await tx.page.updateMany({ where: { projectId, path: pagePath }, data: { sections: currentPage.sections } })
  }, { isolationLevel: 'Serializable' })
  console.log(`Saved ${updates.length} distinct option images in a new preview draft.`)
} finally { await prisma.$disconnect() }
