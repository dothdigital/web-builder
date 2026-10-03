import assert from 'node:assert/strict'
import React from 'react'
import JSZip from 'jszip'
import { buildStaticExport } from '../apps/web/src/lib/static-export'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultTokens, getComponent, componentLayoutNodes } from '@awb/component-registry'
import type { WebsiteSection, WebsiteModel } from '@awb/website-model'
import { editObjectProps, moveObject, restoreMovedSection } from '../apps/web/src/lib/object-editing'
import { sectionElementTree } from '../apps/web/src/lib/element-tree'
Object.assign(globalThis, { React })
const about = getComponent('AboutSplitOverlap')!
const hero = getComponent('HeroEditorial')!
const source: WebsiteSection = { id: 'source', componentVersion: '1.0.0', hidden: false, componentId: about.componentId, props: { ...(about.fixture as object), layout: 'steps', points: [{ title: 'Understand', body: 'Research the whole business.' }], cta: { label: 'Enquire', href: '/enquire' }, imageUrl: 'https://example.com/concept.png', elementColors: { '/points/0': { backgroundColor: '#123456' }, '/points/0/title': { color: '#abcdef' } } } }
const destination: WebsiteSection = { id: 'target', componentVersion: '1.0.0', hidden: false, componentId: hero.componentId, props: hero.fixture as Record<string, unknown> }
const original = [source, destination]
const json = JSON.stringify(original)
const position = { x: 20, y: 140, width: 40, height: 220 }
const legacyMove = moveObject(original, source.id, '/layout/0', destination.id, position)!
const legacySnapshot = JSON.stringify(legacyMove.sections)
const recovered = restoreMovedSection(legacyMove.sections, destination.id, legacyMove.path, 'restored')
assert.equal(JSON.stringify(legacyMove.sections), legacySnapshot, 'Restoration preserves undo snapshots')
assert.equal(recovered[1]!.id, 'restored')
assert.equal(recovered[1]!.componentId, source.componentId)
assert.deepEqual(recovered[1]!.props, source.props)
assert.equal(recovered[2]!.props.freeLayoutMinHeight, 0)
assert.deepEqual(recovered[2]!.props.removedElements, ['/freeElements/0'])
assert.equal(restoreMovedSection(original, source.id, '/points/0', 'invalid'), original)
const render = (section: WebsiteSection) => {
  const definition = getComponent(section.componentId)!
  return renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(section.props), context: { tokens: defaultTokens, baseUrl: '' } }))
}
const moved = moveObject(original, source.id, '/points/0', destination.id, position)!
assert.ok(moved, 'Card can move across component families')
assert.equal(JSON.stringify(original), json, 'Undo snapshot is unchanged')
assert.deepEqual(moved.sections[0]!.props.removedElements, ['/points/0'])
assert.equal(moved.path, '/freeElements/0')
let html = render(moved.sections[1]!)
assert.match(html, /Understand/)
assert.match(html, /Research the whole business/)
assert.match(html, /background:#123456/)
assert.match(html, /color:#abcdef/)
assert.match(html, /data-awb-element="\/freeElements\/0\/content\/points\/0\/title"/)
assert.match(html, /--free-x:20%/)
const edited = editObjectProps(moved.sections[1]!.props, moved.path, { type: 'style', value: { backgroundColor: '#654321' } })
html = render({ ...destination, props: edited })
assert.match(html, /background:#654321/)
const typed = editObjectProps(edited, `${moved.path}/content/points/0/title`, { type: 'content', pointer: `${moved.path}/content/points/0/title`, value: 'Explore' })
assert.match(render({ ...destination, props: typed }), /Explore/)
const movedAgain = moveObject(moved.sections, destination.id, moved.path, source.id, { ...position, x: 99, width: 70 })!
assert.ok(movedAgain)
assert.match(render(movedAgain.sections[0]!), /--free-x:30%/)
assert.deepEqual(movedAgain.sections[1]!.props.removedElements, ['/freeElements/0'])
const button = moveObject(original, source.id, '/cta', source.id, position, true)!
assert.ok(button)
html = render(button.sections[0]!)
assert.equal((html.match(/href="\/enquire"/g) ?? []).length, 1)
assert.match(html, /Enquire \(copy/)
const hidden = editObjectProps(button.sections[0]!.props, button.path, { type: 'delete' })
assert.ok((hidden.removedElements as string[]).includes(button.path))
const layout = componentLayoutNodes(source.componentId, source.props)
assert.ok(layout.length)
const container = moveObject(original, source.id, layout[0]!.path, destination.id, position)!
assert.ok(container, 'Parent layout box moves all contents')
html = render(container.sections[1]!)
assert.match(html, /Research the whole business/)
assert.match(html, /concept.png/)
assert.match(html, /href="\/enquire"/)
const tree = sectionElementTree(destination.componentId, moved.sections[1]!.props)
assert.ok(tree.some((entry) => entry.path === moved.path && entry.children.length))
assert.equal(moveObject(original, source.id, '/not-a-node', destination.id, position), undefined)
assert.equal(moveObject(original, source.id, '/points/0', 'unknown', position), undefined)
const nested = { ...moved.sections[1]!.props, freeElements: [{ ...(moved.sections[1]!.props.freeElements as object[])[0], content: { ...source.props, freeElements: [{}] } }] }
assert.equal(hero.propsSchema.safeParse(nested).success, false, 'No recursive detached snapshots')
console.log('PASS: atomic cross-section moves, parent children and images, saved styles and edits, independent copies, cleared copied links, bounded placement, removal, tree paths, and invalid moves.')

const buttonAgain = moveObject(button.sections, source.id, '/cta', source.id, position, true)!
const copiedButtons = buttonAgain.sections[0]!.props.freeElements as Array<{ content: { cta: { label: string } } }>
assert.notEqual(copiedButtons[0]!.content.cta.label, copiedButtons[1]!.content.cta.label)
const copiedHeading = moveObject(original, destination.id, '/heading', destination.id, position, true)!
assert.equal((render(copiedHeading.sections[1]!).match(/<h1/g) ?? []).length, 1)
assert.ok(!render(moved.sections[0]!).includes('Research the whole business'), 'Moved content is removed from the original rendered DOM')
assert.equal(getComponent(destination.componentId)!.propsSchema.safeParse({ ...moved.sections[1]!.props, freeElements: [{ ...(moved.sections[1]!.props.freeElements as object[])[0], content: { ...source.props, elementColors: { '/heading': { fontSize: 999 } } } }] }).success, false)
async function checkExport() {
  const header = getComponent('HeaderTransparent')!, footer = getComponent('FooterCompact')!
  const model = { site: { name: 'Layout test', locale: 'en', previewHost: 'test.preview.local' }, tokens: defaultTokens, contact: { hours: [] }, socials: [], google: {}, analyticsSettings: {}, publishSettings: { robotsAllowIndexing: true }, globalComponents: { header: { componentId: header.componentId, props: header.fixture }, footer: { componentId: footer.componentId, props: footer.fixture } }, pages: [{ id: 'home', title: 'Home', path: '/', h1: 'Home', seo: { title: 'Home', description: 'Export test' }, sections: JSON.parse(JSON.stringify(container.sections)) }] } as unknown as WebsiteModel
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'), { headers: { 'content-type': 'image/png' } })
  try {
    const zip = await JSZip.loadAsync(await buildStaticExport(model, { siteUrl: 'https://example.com' }))
    const page = await zip.file('index.html')!.async('string')
    assert.match(page, /data-awb-free-item="true"/)
    assert.match(page, /--free-x:20%/)
    assert.match(page, /Research the whole business/)
    assert.match(page, /src=".\/assets\/images\//)
    assert.ok(Object.keys(zip.files).some((path) => path.startsWith('assets/images/') && path.endsWith('.png')))
    assert.match(page, /data-awb-flow-slot="true"/)
    assert.ok(!page.includes('@container (max-width:600px)'), 'Free-positioned objects never switch to flow layout')
    assert.ok(!page.includes('data-awb-object-toolbar'))
    console.log('PASS: JSON round-trip and static ZIP preserve moved groups, coordinates, reserved original spaces and bundled images. Asset fetching mocked; no external services called.')
  } finally { globalThis.fetch = originalFetch }
}
void checkExport()

const slot = { width: 330, height: 180, display: 'grid' as const, marginTop: 5, marginRight: 0, marginBottom: 10, marginLeft: 0 }
const steady = moveObject(original, source.id, '/points/0', source.id, { ...position, y: 450 }, false, slot)!
assert.deepEqual((steady.sections[0]!.props.flowSlots as Record<string, unknown>)['/points/0'], slot)
const steadyHtml = render(steady.sections[0]!)
assert.match(steadyHtml, /data-awb-flow-slot="true" aria-hidden="true"/)
assert.match(steadyHtml, /width:330px;height:180px/)
assert.equal((steadyHtml.match(/Research the whole business/g) ?? []).length, 1)
const childMoved = moveObject(steady.sections, source.id, '/freeElements/0/content/points/0/title', source.id, { ...position, y: 700 }, false, { ...slot, height: 50 })!
assert.ok(childMoved)
const snapshots = childMoved.sections[0]!.props.freeElements as Array<{ content: Record<string, unknown> }>
assert.ok((snapshots[0]!.content.removedElements as string[]).includes('/points/0/title'), 'Moving a child within its section retains the parent removal')
assert.ok((snapshots[0]!.content.flowSlots as Record<string, unknown>)['/points/0/title'], 'Parent keeps the child footprint')
assert.equal((render(childMoved.sections[0]!).match(/Understand/g) ?? []).length, 1, 'Child is visible once')
console.log('PASS: measured original footprint retained; same-section child moves preserve the parent layout and do not duplicate visible content.')

const stationary = moveObject(original, source.id, '/points/0', source.id, position, false, slot, { x: 70, y: -30 })!
assert.equal(stationary.path, '/points/0', 'Same-section move retains its original identity')
assert.equal(stationary.sections[0]!.props.removedElements, undefined, 'No removal from document flow')
assert.equal(stationary.sections[0]!.props.freeElements, undefined, 'No replacement or relocated layout container')
assert.deepEqual(stationary.sections[0]!.props.elementOffsets, { '/points/0': { x: 70, y: -30 } })
const stationaryHtml = render(stationary.sections[0]!)
assert.match(stationaryHtml, /translate:70px -30px/)
assert.ok(!stationaryHtml.includes('data-awb-flow-slot='), 'Original node retains its intrinsic dimensions')
assert.equal((stationaryHtml.match(/Research the whole business/g) ?? []).length, 1)
const repositioned = moveObject(stationary.sections, source.id, '/points/0', source.id, position, false, slot, { x: -20, y: 10 })!
assert.deepEqual(repositioned.sections[0]!.props.elementOffsets, { '/points/0': { x: 50, y: -20 } })
const transferred = moveObject(repositioned.sections, source.id, '/points/0', destination.id, position, false, slot)!
assert.ok(!render(transferred.sections[1]!).includes('translate:50px -20px'), 'Cross-section transfer does not apply the old translation twice')
const up = moveObject(moved.sections, destination.id, moved.path, destination.id, { ...position, y: 0 })!
assert.equal(up.sections[1]!.props.freeLayoutMinHeight, position.y + position.height, 'Moving an already detached object up cannot collapse its section')
assert.match(render(up.sections[1]!), /min-height:360px/)
console.log('PASS: within-section moves translate the original node, repeated moves accumulate correctly, and detached moves preserve section height.')

const story: WebsiteSection = { ...source, props: { ...source.props, heading: 'A whole-journey approach to continuous improvement' } }
const shiftedHeading = moveObject([story, destination], story.id, '/heading', story.id, { x: 5, y: 80, width: 40, height: 110 }, false, { ...slot, height: 110 }, { x: -280, y: 0 })!
assert.equal(shiftedHeading.path, '/heading')
assert.deepEqual(shiftedHeading.sections[0]!.props.points, story.props.points)
assert.equal(shiftedHeading.sections[0]!.props.body, story.props.body)
assert.equal(shiftedHeading.sections[0]!.props.imageUrl, story.props.imageUrl)
const headingHtml = render(shiftedHeading.sections[0]!)
assert.match(headingHtml, /data-awb-element="\/heading"[^>]*translate:-280px 0px/)
assert.ok(!headingHtml.includes('data-awb-flow-slot='))
assert.ok(!headingHtml.includes('data-awb-free-layout='))
assert.equal(headingHtml.match(/<section[\s\S]*<\/section>/)![0].replace(';--awb-desktop-geometry:1', '').replace(';translate:-280px 0px;position:relative;z-index:2', ''), render(story).match(/<section[\s\S]*<\/section>/)![0], 'Moving the story heading changes only its visual translation; every sibling and parent stays identical')
console.log('PASS: moving the image-led-story heading left leaves the original heading, parent column, body, image and cards in the same layout.')

const wideStory = editObjectProps(story.props, '/heading', { type: 'fullWidth', offsetX: -420, height: 110 })
const wideHtml = render({ ...story, props: wideStory })
assert.match(wideHtml, /data-awb-width-boundary="section"/)
assert.match(wideHtml, /width:100cqw/)
assert.match(wideHtml, /left:0%/)
assert.match(wideHtml, /translate:0px 0px/)
assert.ok(!wideHtml.includes('translate:-420px'), 'Full-width positioning is independent of editor pixel offsets')
assert.match(wideHtml, /height:110px/)
assert.ok(!wideHtml.includes('width-basis:'), 'Sizing metadata must not leak into CSS')
assert.equal(wideStory.body, story.props.body)
assert.deepEqual(wideStory.points, story.props.points)
const shorter = editObjectProps(wideStory, '/heading', { type: 'style', value: { height: 60 } })
assert.match(render({ ...story, props: shorter }), /height:60px/)
const shortCard = editObjectProps(story.props, '/points/0', { type: 'style', value: { height: 80, paddingTop: 4, paddingBottom: 4 } })
const shortCardHtml = render({ ...story, props: shortCard })
assert.match(shortCardHtml, /height:80px/)
assert.ok(!shortCardHtml.includes('min-height:80px'), 'Explicit box height is not an auto-expanding minimum')
assert.match(shortCardHtml, /padding-top:4px;padding-bottom:4px/)
console.log('PASS: full-section heading width, preserved original text-box height, editable smaller heights, and block padding.')

const savedPreviewCase = { ...story.props, heading: 'A connected view of business growth', elementColors: { '/heading': { width: 98, height: 66, textAlign: 'center', widthBasis: 'section' } }, elementOffsets: { '/heading': { x: -433.4140625, y: 1.796875 } } }
const previewHeading = render({ ...story, props: savedPreviewCase })
assert.match(previewHeading, /position:absolute;/)
assert.match(previewHeading, /left:1%;right:auto;top:auto/)
assert.match(previewHeading, /width:98cqw/)
assert.match(previewHeading, /translate:0px 1.796875px/)
assert.match(previewHeading, /data-awb-width-slot="true" style="height:66px/)
assert.ok(!previewHeading.includes('-433.4140625px'), 'Legacy editor offsets cannot shift section-wide text back into a column')
console.log('PASS: saved 98%-width heading anchors at 1% of the section in editor and preview, preserving its 66px vertical slot.')

for (const [verticalAlign, justifyContent] of [['top', 'flex-start'], ['middle', 'center'], ['bottom', 'flex-end']]) {
  const aligned = editObjectProps(savedPreviewCase, '/heading', { type: 'style', value: { height: 140, verticalAlign, textAlign: 'justify' } })
  const html = render({ ...story, props: aligned })
  assert.match(html, /flex-direction:column/)
  assert.ok(html.includes(`justify-content:${justifyContent}`))
  assert.match(html, /text-align:justify/)
  assert.match(html, /height:140px/)
  assert.match(html, /left:1%/)
}
console.log('PASS: top/middle/bottom alignment persists alongside justified, section-wide text.')

async function verifySavedProject(projectId: string) {
  const { config } = await import('dotenv'); config({ quiet: true })
  const { prisma } = await import('@awb/database')
  const { SiteRenderer } = await import('../apps/web/src/components/site-renderer')
  try {
    const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
    const model = version.model as unknown as WebsiteModel
    const page = model.pages.find((entry) => entry.path === '/')!
    const html = renderToStaticMarkup(React.createElement(SiteRenderer, { model, page, baseUrl: '' }))
    const heading = html.match(/<h2\b[^>]*>A connected view of business growth<\/h2>/)?.[0]
    assert.ok(heading, 'Saved heading renders through the real preview renderer')
    assert.match(heading, /width:98cqw/)
    assert.match(heading, /left:1%/)
    assert.ok(!heading.includes('-433.4140625px'))
    console.log(`PASS: saved project version ${version.version} renders the home-page heading at 98% of section width, anchored at 1%, through SiteRenderer. Database read only.`)
  } finally { await prisma.$disconnect() }
}
if (process.argv[2]) void verifySavedProject(process.argv[2])
