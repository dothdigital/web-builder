import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
config({ path: '.env', quiet: true })
const { prisma } = await import('@awb/database')
const { hashPassword, tokenHash } = await import('../apps/web/src/lib/account-security')
const base = 'http://localhost:3000'
const id = randomUUID(), email = `http-${id}@validation.invalid`, password = `Temporary-validation-${id}`
const jar = new Map<string, string>()
const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(base + path, { ...init, redirect: 'manual', headers: { ...init.headers, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') }, signal: AbortSignal.timeout(60000) })
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]!, index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)) }
  return response
}
let userId = '', workspaceId = ''
try {
  const { StubAiProvider } = await import('@awb/ai')
  const { getComponent, defaultTokens } = await import('@awb/component-registry')
  const { websiteModelSchema } = await import('@awb/website-model')
  const { designReferenceSchema } = await import('@awb/shared/design-reference')
  const user = await prisma.user.create({ data: { email, name: 'Showcase validation', passwordHash: await hashPassword(password), emailVerified: new Date(), memberships: { create: { role: 'OWNER', workspace: { create: { name: 'Showcase validation', slug: `showcase-${id}` } } } } }, include: { memberships: true } })
  userId = user.id; workspaceId = user.memberships[0]!.workspaceId
  const reference = designReferenceSchema.parse({ url: 'kinexmedia.com', mode: 'layout', notes: 'Large project cards, our own brand colours.' })
  const project = await prisma.project.create({ data: { workspaceId, name: 'Showcase validation', slug: `showcase-${id}`, previewHost: `showcase-${id}.invalid`, designReference: reference } })
  assert.deepEqual(project.designReference, reference, 'Reference choices persist')
  const brief = { businessName: 'Showcase validation', description: 'A studio with real products and uploaded credentials.', services: [], goals: ['FORM'], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [] }
  const provider = new StubAiProvider({ seed: 'local-showcase-validation' })
  const { data: analysis } = await provider.analyzeBrief(brief)
  const { data: directions } = await provider.proposeDesignDirections(brief, analysis)
  const component = (componentId: string, props?: unknown) => ({ componentId, props: getComponent(componentId)!.propsSchema.parse(props ?? getComponent(componentId)!.fixture) })
  const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: brief.businessName, previewHost: project.previewHost }, businessProfileRef: project.id, designDna: directions.options[0]!.dna, tokens: defaultTokens, navigation: { primaryMenu: [] }, globalComponents: { header: component('HeaderSplitUtility'), footer: component('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Our work', h1: 'Our work', seo: { title: 'Our work' }, sections: [ { id: 'hero', ...component('HeroEditorial') }, { id: 'work', ...component('PortfolioShowcase', { items: [{ title: 'Validation product', category: 'Products' }] }) }, { id: 'proof', ...component('CredentialsShowcase', { items: [{ title: 'Validation credential', issuer: 'User supplied' }] }) } ] }] })
  await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, schemaVersion: '1.0.0', model: JSON.parse(JSON.stringify(model)) } })
  const csrf = await (await request('/api/auth/csrf')).json() as { csrfToken: string }
  const login = await request('/api/auth/callback/password', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base, 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/dashboard` }) })
  assert.equal(login.status, 200)
  const session = await (await request('/api/auth/session')).json() as { user?: { id?: string } }
  assert.equal(session.user?.id, userId)
  const intake = await request('/onboarding'); assert.equal(intake.status, 200)
  assert.ok((await intake.text()).includes('Design inspiration (optional)'))
  const editor = await request(`/projects/${project.id}/editor`); assert.equal(editor.status, 200)
  const editorHtml = await editor.text(); assert.ok(editorHtml.includes('Validation product')); assert.ok(editorHtml.includes('Validation credential'))
  const preview = await request(`/preview/${project.id}`); assert.equal(preview.status, 200)
  const html = await preview.text(); assert.ok(html.includes('Validation product')); assert.ok(html.includes('Validation credential')); assert.ok(!html.includes('Invalid input'))
  const archive = await request(`/api/projects/${project.id}/export?source=draft`); assert.equal(archive.status, 200); assert.ok(archive.headers.get('content-type')?.includes('application/zip')); assert.ok((await archive.arrayBuffer()).byteLength > 1000)
  console.log('PASS: live local intake, new reference database fields, editor, Preview and HTML export with portfolio and credentials. Temporary account/project removed; no AI, email or payment calls.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  const window = Math.floor(Date.now() / (15 * 60000))
  await prisma.authRateLimit.deleteMany({ where: { key: tokenHash(`login:${email}:${window}`) } })
  await prisma.$disconnect()
}
