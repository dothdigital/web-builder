import assert from 'node:assert/strict'
import { pageSchema } from '@awb/website-model'
import { applyPageRewrite } from '../apps/web/src/lib/page-rewrite'
const page = pageSchema.parse({ id: 'home', path: '/', title: 'Original', h1: 'Original heading', seo: { title: 'Original SEO', description: 'Original description' }, sections: [{ id: 'hero', componentId: 'HeroEditorial', props: { heading: 'Original heading', body: 'Original body', imageUrl: '/uploads/hero.png', primaryCta: { label: 'Contact', href: '/contact' } } }, { id: 'contact', componentId: 'ContactSplit', props: { heading: 'Contact', phone: '123' } }] })
const original = JSON.stringify(page)
const next = applyPageRewrite(page, [{ op: 'replace', path: '/sections/0/props/heading', value: 'New heading' }, { op: 'replace', path: '/seo/title', value: 'New SEO' }, { op: 'replace', path: '/sections/0/props/primaryCta/label', value: 'Talk to us' }])
assert.equal(next.h1, 'New heading')
assert.equal(next.seo.title, 'New SEO')
assert.equal(next.sections[0]!.props.imageUrl, '/uploads/hero.png')
assert.equal(JSON.stringify(page), original)
for (const path of ['/path', '/sections/0/props/imageUrl', '/sections/0/props/primaryCta/href', '/sections/1/props/phone']) assert.throws(() => applyPageRewrite(page, [{ op: 'replace', path, value: 'changed' }]))
assert.throws(() => applyPageRewrite(page, [{ op: 'remove', path: '/sections/0/props/body' }]))
console.log('PASS: page copy and SEO rewrite, synchronized H1, unchanged source, protected images, routes, contact details and layout.')
