import assert from 'node:assert/strict'
import React from 'react'
import JSZip from 'jszip'
import { websiteModelSchema } from '@awb/website-model'
import { buildFaqJsonLd, buildPageJsonLd, buildSitemapXml } from '@awb/seo'
import { defaultTokens, getComponent } from '@awb/component-registry'
import { addContentPage, generatedContentPage, contentRequestSchema, validateContentRequest } from '../apps/web/src/lib/content-creation'
import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
import { buildStaticExport } from '../apps/web/src/lib/static-export'
Object.assign(globalThis, { React })
const chrome = (id: string) => ({ componentId: id, componentVersion: '1.0.0', props: getComponent(id)!.fixture })
const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: 'Example', previewHost: 'example.test' }, businessProfileRef: 'test', tokens: defaultTokens, designDna: { direction: 'corporate', composition: { symmetry: 'symmetric', density: 'balanced', width: 'wide', rhythm: 'modular' }, typography: { headingStyle: 'geometric-sans', bodyStyle: 'clean-sans', scale: 'standard' }, imagery: { style: 'documentary', dominance: 'medium', treatment: 'natural' }, navigation: 'split-nav', motion: 'none', corners: 'soft', ctaStyle: 'solid', colorBehavior: 'tonal' }, navigation: { primaryMenu: [] }, globalComponents: { header: chrome('HeaderSplitUtility'), footer: chrome('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Home', h1: 'Home', seo: { title: 'Home', description: 'Useful advice from our business.' }, sections: [{ id: 'hero', componentId: 'HeroTypographic', props: getComponent('HeroTypographic')!.fixture }] }] })
const input = contentRequestSchema.parse({ includeFaq: false, kind: 'blog', topic: 'Planning guide', slug: 'planning-guide', keyword: 'planning', audience: 'New customers', goal: 'Help people plan', details: 'Explain how to plan thoughtfully using only verified business facts.', internalPaths: ['/'] })
const article = { title: 'Planning guide', h1: 'Planning guide', seo: { title: 'Planning guide', description: 'Learn how to plan your next steps with clear, practical guidance.' }, sections: [{ id: 'ai', componentId: 'BlogArticle', props: { heading: 'Planning guide', intro: 'Start your planning here.', blocks: [{ heading: 'Start here', body: 'Consider what matters to you.', links: [{ label: 'Explore our business', href: '/' }] }, { heading: 'Next steps', body: 'Talk to our team.', links: [] }] } }] }
const operations = [{ op: 'add' as const, path: '/page', value: article }]
const faqSection = { id: 'faq', componentId: 'FaqAccordion', props: { heading: 'Planning questions', items: [{ question: 'How do I start?', answer: 'Start with your goals.' }, { question: 'Who can help?', answer: 'Contact our team.' }] } }
const withFaq = generatedContentPage(model, { ...input, includeFaq: true }, [{ op: 'add', path: '/page', value: { ...article, sections: [...article.sections, faqSection] } }], 'faq-post')
assert.ok(buildFaqJsonLd(withFaq))
assert.throws(() => generatedContentPage(model, { ...input, includeFaq: true }, operations, 'missing-faq'), /FAQ/)
withFaq.sections[1]!.props.removedElements = ['/items/0']
assert.equal((buildFaqJsonLd(withFaq)!.mainEntity as unknown[]).length, 1)
withFaq.sections[1]!.hidden = true
assert.equal(buildFaqJsonLd(withFaq), undefined)
const page = generatedContentPage(model, input, operations, 'article-one')
const customInput = { ...input, kind: 'page' as const, slug: 'planning-service' }
const customProps = { ...(getComponent('HeroTypographic')!.fixture as object), heading: 'Planning service', primaryCta: { label: 'Home', href: '/' }, secondaryCta: { label: 'Learn more', href: '/' } }
const custom = generatedContentPage(model, customInput, [{ op: 'add', path: '/page', value: { ...article, h1: 'Planning service', sections: [{ id: 'hero', componentId: 'HeroTypographic', props: customProps }] } }], 'custom-page')
assert.equal(custom.path, '/planning-service')
assert.ok(addContentPage(model, custom).navigation.primaryMenu.some((link) => link.pageId === custom.id))

const illustrated = generatedContentPage(model, { ...input, coverImageUrl: 'https://example.com/cover.jpg', coverImageAlt: 'A planning notebook' }, operations, 'illustrated')
assert.equal(illustrated.sections[0]!.props.imageUrl, 'https://example.com/cover.jpg')
assert.equal(illustrated.sections[0]!.props.imageAlt, 'A planning notebook')
const illustratedModel = addContentPage(model, illustrated)
const illustratedIndex = illustratedModel.pages.find((entry) => entry.pageType === 'BLOG_INDEX')!
assert.equal((resolveSectionMedia(illustratedModel, illustratedIndex, illustratedIndex.sections[0]!).items as { imageUrl: string }[])[0]!.imageUrl, 'https://example.com/cover.jpg')

const original = JSON.stringify(model)
const next = addContentPage(model, page)
assert.equal(JSON.stringify(model), original)
const second = generatedContentPage(next, { ...input, slug: 'another-guide' }, operations, 'article-two')
assert.equal(addContentPage(next, second).pages.filter((p) => p.pageType === 'BLOG_INDEX').length, 1)
assert.equal(next.pages.filter((p) => p.pageType === 'BLOG_INDEX').length, 1)
assert.throws(() => addContentPage(next, page), /already exists/)
assert.throws(() => validateContentRequest(next, input), /already exists/)
const bad = structuredClone(operations); bad[0]!.value.sections[0]!.props.blocks[0]!.links[0]!.href = '/missing'
assert.throws(() => generatedContentPage(model, input, bad, 'bad'), /unselected page/)
const index = next.pages.find((p) => p.pageType === 'BLOG_INDEX')!
assert.equal((resolveSectionMedia(next, index, index.sections[0]!).items as { href: string }[])[0]!.href, page.path)
async function main() {
  const zip = await JSZip.loadAsync(await buildStaticExport(next, { siteUrl: 'https://example.com' }))
  const html = await zip.file('blog/planning-guide/index.html')!.async('string')
  assert.match(html, /BlogPosting/)
  assert.match(html, /BreadcrumbList/)
  assert.match(html, /WebPage/)
  assert.ok(zip.file('robots.txt'))
  assert.ok(zip.file('llms.txt'))
  assert.match(await zip.file('robots.txt')!.async('string'), /Sitemap: https:\/\/example.com\/sitemap.xml/)
  const noindex = structuredClone(next)
  noindex.pages.find((entry) => entry.id === page.id)!.seo.index = false
  assert.ok(!buildSitemapXml(noindex, 'https://example.com').includes('blog/planning-guide'))
  const graph = buildPageJsonLd(next, page, 'https://example.com')['@graph'] as Array<Record<string, unknown>>
  assert.equal(graph[1]!.url, 'https://example.com/blog/planning-guide')
  assert.equal((graph[2]!.itemListElement as unknown[]).length, 3)

  assert.match(html, /<h1[^>]*>Planning guide<\/h1>/)
  assert.match(html, /href="\.\.\/\.\.\/index.html"/)
  const listing = await zip.file('blog/index.html')!.async('string')
  assert.match(listing, /Planning guide/)
  assert.match(listing, /blog\/planning-guide\/index.html/)
  assert.match(await zip.file('sitemap.xml')!.async('string'), /blog\/planning-guide/)
  console.log('PASS: blog draft, automatic index, preserved existing pages, duplicate rejection, internal link validation, metadata, article schema, sitemap and standalone exported links.')
}
void main()
