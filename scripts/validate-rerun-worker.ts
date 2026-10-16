import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

async function main() {
  process.env.AI_PROVIDER = 'stub'
  delete process.env.S3_BUCKET
  const directory = await mkdtemp(`${tmpdir()}/webtummy-rerun-test-`)
  process.env.LOCAL_UPLOAD_DIR = directory
  const { prisma } = await import('@awb/database')
  const { defaultTokens, getComponent, listComponents } = await import('@awb/component-registry')
  const { websiteModelSchema } = await import('@awb/website-model')
  const { runGeneration } = await import('../packages/pipeline/src/run')
  const { getGenerationProgress } = await import('../packages/pipeline/src/progress')
  const { OpenAiProvider, StubAiProvider } = await import('@awb/ai')
  const id = randomUUID()
  const workspace = await prisma.workspace.create({ data: { name: 'Isolated rerun verification', slug: `rerun-test-${id}`, billingExempt: true, billingExemptionReason: 'Temporary automated verification' } })
  const user = await prisma.user.create({ data: { email: `rerun-${id}@example.invalid` } })
  try {
    const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'Rerun verification', slug: 'rerun-verification', previewHost: `rerun-${id}.invalid` } })
    const header = listComponents().find(component => component.family === 'HEADER')!
    const footer = listComponents().find(component => component.family === 'FOOTER')!
    const hero = getComponent('HeroEditorial')!
    const model = websiteModelSchema.parse({
      schemaVersion: '1.0.0', site: { name: 'Rerun verification', previewHost: 'test.invalid' }, businessProfileRef: project.id,
      designDna: { direction: 'modern-minimal', composition: { symmetry: 'symmetric', density: 'balanced', width: 'contained', rhythm: 'modular' }, typography: { headingStyle: 'geometric-sans', bodyStyle: 'clean-sans', scale: 'standard' }, imagery: { style: 'documentary', dominance: 'medium', treatment: 'natural' }, navigation: 'compact-sticky', motion: 'none', corners: 'soft', ctaStyle: 'solid', colorBehavior: 'accent-led' },
      tokens: defaultTokens, navigation: { primaryMenu: [] },
      globalComponents: { header: { componentId: header.componentId, props: { ...header.fixture as object, logoImageUrl: '/original-logo.png' } }, footer: { componentId: footer.componentId, props: footer.fixture } },
      pages: [{ id: 'home', path: '/', title: 'Home', h1: 'Original heading', seo: { title: 'Home', description: 'A test business description' }, sections: [{ id: 'hero', componentId: hero.componentId, props: { ...hero.fixture as object, heading: 'Original heading', body: 'Original copy', imageUrl: '/original-photo.png' } }] }],
    })
    let base = await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, kind: 'DRAFT', model, schemaVersion: '1.0.0' } })
    const logo = await prisma.asset.create({ data: { workspaceId: workspace.id, projectId: project.id, kind: 'LOGO', source: 'UPLOAD', storageKey: 'test-logo', url: '/new-logo.png', mimeType: 'image/png' } })
    const photo = await prisma.asset.create({ data: { workspaceId: workspace.id, projectId: project.id, kind: 'IMAGE', source: 'UPLOAD', storageKey: 'test-photo', url: '/new-photo.png', mimeType: 'image/png', altText: 'Our office' } })
    const execute = async (rerun: import('@awb/shared/rerun-request').RerunRequest) => {
      const job = await prisma.contentJob.create({ data: { projectId: project.id, workspaceId: workspace.id, requestedBy: user.id, kind: 'WEBSITE', title: 'Isolated verification', status: 'READY', emailStatus: 'SKIPPED', input: { rerun, baseVersionId: base.id } } })
      const result = await runGeneration({ projectId: project.id, correlationId: job.id, rerun, baseVersionId: base.id })
      const progress = await getGenerationProgress(project.id, job.id)
      assert.equal(progress.status, 'succeeded')
      assert.equal(progress.percent, 100)
      assert.equal(progress.stages.length, rerun.scope === 'FULL' ? 9 : 2)
      base = await prisma.websiteVersion.findUniqueOrThrow({ where: { id: result.websiteVersionId } })
      return websiteModelSchema.parse(base.model)
    }
    // Any accidentally invoked full-build stage must fail this test.
    const analyzeBrief = StubAiProvider.prototype.analyzeBrief
    StubAiProvider.prototype.analyzeBrief = async () => { throw new Error('Targeted update invoked full generation') }
    const logoOnly = await execute({ scope: 'UPLOADS', instruction: '', logoAssetId: logo.id, imageAssetIds: [] })
    assert.equal(logoOnly.globalComponents.header.props.logoImageUrl, logo.url)
    assert.equal(logoOnly.globalComponents.footer.props.logoImageUrl, logo.url)
    assert.deepEqual(logoOnly.pages, model.pages)
    assert.deepEqual(logoOnly.tokens, model.tokens)
    const photos = await execute({ scope: 'UPLOADS', instruction: '', imageAssetIds: [photo.id] })
    assert.equal(photos.pages[0]!.sections[0]!.props.imageUrl, photo.url)
    assert.equal(photos.pages[0]!.sections[0]!.props.heading, 'Original heading')
    const images = await execute({ scope: 'IMAGES', instruction: 'Modern office photos', imageAssetIds: [], logoAssetId: logo.id })
    assert.equal(images.pages[0]!.sections[0]!.props.imageUrl, photo.url)
    assert.deepEqual(images.tokens, model.tokens)
    assert.deepEqual(images.globalComponents, photos.globalComponents)
    assert.equal(images.pages[0]!.sections[0]!.props.body, 'Original copy')
    process.env.AI_PROVIDER = 'openai'
    OpenAiProvider.prototype.patchSection = async () => ({ data: { operations: [{ op: 'replace', path: '/sections/0/props/body', value: 'Rewritten copy' }], reason: 'Shorter copy' }, usage: { task: 'section_patch', model: 'mock', inputTokens: 0, outputTokens: 0, costCents: 0 } } as never)
    const content = await execute({ scope: 'CONTENT', instruction: 'Make the copy shorter', imageAssetIds: [] })
    assert.equal(content.pages[0]!.sections[0]!.props.body, 'Rewritten copy')
    assert.equal(content.pages[0]!.sections[0]!.props.imageUrl, images.pages[0]!.sections[0]!.props.imageUrl)
    assert.deepEqual(content.tokens, images.tokens)
    assert.equal(await prisma.websiteVersion.count({ where: { projectId: project.id } }), 5)
    process.env.AI_PROVIDER = 'stub'
    let fullInstruction = ''
    StubAiProvider.prototype.analyzeBrief = async function(brief) { fullInstruction = brief.answers.rerunInstructions ?? ''; return analyzeBrief.call(this, brief) }
    const writePage = StubAiProvider.prototype.writePage
    StubAiProvider.prototype.writePage = async function(...args) {
      const result = await writePage.apply(this, args)
      result.data.sections = result.data.sections.map(section => {
        const definition = getComponent(section.componentId)!
        return { ...section, props: { ...definition.propsSchema.parse(definition.fixture), ...(definition.family === 'HERO' ? { heading: result.data.h1 } : {}) } }
      })
      return result
    }
    await execute({ scope: 'FULL', instruction: 'Focus on home renovation services.', imageAssetIds: [] })
    assert.equal(fullInstruction, 'Focus on home renovation services.')
    const palette = { ...defaultTokens.palette, primary: '#01481d', accent: '#f8b900' }
    const recolored = await execute({ scope: 'UPLOADS', instruction: '', imageAssetIds: [], logoAssetId: logo.id, palette })
    assert.deepEqual(recolored.tokens.palette, palette)
    assert.equal(recolored.globalComponents.header.props.logoImageUrl, logo.url)
    assert.equal(recolored.globalComponents.footer.props.logoImageUrl, logo.url)
    const fullPalette = await execute({ scope: 'FULL', instruction: 'Use our green and gold brand.', imageAssetIds: [], logoAssetId: logo.id, palette })
    assert.deepEqual(fullPalette.tokens.palette, palette)
    console.log('PASS: logo palette survives worker request parsing and applies to the saved draft.')
    console.log('PASS: worker/database integration for all rerun scopes including full-build instructions; new drafts, stage selection and 100% progress verified with no external AI calls.')
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
    await rm(directory, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
