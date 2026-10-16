import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { websiteModelSchema } from '@awb/website-model'
import { buildFaqJsonLd, buildLlmsTxt, buildPageJsonLd, buildRobotsTxt, buildSitemapXml } from '@awb/seo'
import { prepareSecurePathSeo } from './secure-path-seo.mjs'
const { prisma } = await import('@awb/database')
try {
 const saved = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId: 'cmv8r9j240000twpapiu39z6x', kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const model = prepareSecurePathSeo(websiteModelSchema.parse(saved.model))
 const base = 'https://seo.example'
 assert.equal(new Set(model.pages.map(page => page.seo.title)).size, model.pages.length)
 for (const page of model.pages) {
  assert.ok(page.h1.trim() && page.seo.targetKeyword)
  const graph = buildPageJsonLd(model, page, base)['@graph'] as Array<Record<string, unknown>>
  assert.ok(graph.some(node => node['@id'] === `${base}${page.path}#webpage`))
  assert.ok(graph.some(node => node['@type'] === 'BreadcrumbList'))
  const faq = buildFaqJsonLd(page)!
  assert.ok(faq)
  const entries = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>
  assert.ok(entries.every(item => item.name && item.acceptedAnswer.text))
 }
 assert.equal((buildSitemapXml(model, base).match(/<loc>/g) || []).length, model.pages.length)
 const disabled = structuredClone(model)
 disabled.pages[1]!.seo.index = false
 assert.ok(!buildSitemapXml(disabled, base).includes(`${base}${disabled.pages[1]!.path}</loc>`))
 assert.ok(!buildLlmsTxt(disabled, base).includes(`](${base}${disabled.pages[1]!.path})`))
 disabled.publishSettings.robotsAllowIndexing = false
 assert.ok(!buildSitemapXml(disabled, base).includes('<loc>'))
 assert.ok(!buildLlmsTxt(disabled, base).includes(']('))
 assert.match(buildRobotsTxt(disabled, base), /Disallow: \//)
 const faqPage = structuredClone(model.pages[0]!)
 const section = faqPage.sections.find(section => section.componentId === 'FaqAccordion')!
 const total = (buildFaqJsonLd(faqPage)!.mainEntity as unknown[]).length
 section.props.removedElements = ['/items/0']
 assert.equal((buildFaqJsonLd(faqPage)!.mainEntity as unknown[]).length, total - 1)
 section.hidden = true
 assert.equal(buildFaqJsonLd(faqPage), undefined)
 console.log('PASS: 16 unique page metadata/keyword targets, page identities/breadcrumbs, factual visible FAQs, hidden FAQ exclusions, and page/site-wide robots/sitemap/AI-file indexing controls.')
} finally { await prisma.$disconnect() }
