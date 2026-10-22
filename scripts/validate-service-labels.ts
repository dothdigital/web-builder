import assert from 'node:assert/strict'
import { formatServiceLabel, type WebsiteModel } from '@awb/website-model'
import { normalizeServiceLabels, siteChrome } from '@awb/component-registry'
for (const [input, expected] of [['life insurance', 'Life Insurance'], ['CRITICAL INSURANCE', 'Critical Insurance'], ['rrsp / resp / rdsp / tfsa', 'RRSP / RESP / RDSP / TFSA'], ['seo and it services', 'SEO And IT Services'], ['iPhone repair', 'iPhone Repair'], ['WordPress support', 'WordPress Support'], [' children’s dental-care ', 'Children’s Dental-Care']]) assert.equal(formatServiceLabel(input!), expected)
const model = { pages: [{ id: 'home', path: '/', title: 'Home', sections: [{ componentId: 'Tpl_finbiz_1_3', props: { text2: 'life insurance', text3: 'We offer life insurance for families.' } }] }, { id: 'life', path: '/services/life-insurance', pageType: 'SERVICE', title: 'life insurance', navLabel: 'life insurance', h1: 'life insurance', sections: [] }], navigation: { primaryMenu: [{ label: 'life insurance', linkType: 'PAGE', pageId: 'life', children: [] }] }, globalComponents: { header: { props: { items: [{ label: 'Services', href: '/services', children: [{ label: 'life insurance', href: '/services/life-insurance' }] }] } }, footer: { props: { columns: [{ title: 'Services', items: [{ label: 'life insurance', href: '/services/life-insurance' }] }] } } }, contact: {}, socials: [] } as unknown as WebsiteModel
const result = normalizeServiceLabels(model)
assert.equal(result.pages[1]!.title, 'Life Insurance')
assert.equal(result.pages[1]!.h1, 'Life Insurance')
assert.equal(result.pages[0]!.sections[0]!.props.text2, 'Life Insurance')
assert.equal(result.pages[0]!.sections[0]!.props.text3, 'We offer life insurance for families.')
assert.equal(result.navigation.primaryMenu[0]!.label, 'Life Insurance')
assert.equal((siteChrome(model).header.items[0]!.children![0]!).label, 'Life Insurance')
assert.equal(result.pages[1]!.path, '/services/life-insurance')
assert.equal(model.pages[1]!.title, 'life insurance', 'Render normalization does not mutate saved drafts')
assert.deepEqual(normalizeServiceLabels(result), result)
console.log('PASS: service casing across menus, cards, page titles and footer; acronyms and brand names preserved; body copy, routes and source models unchanged.')
