import assert from 'node:assert/strict'
import { defaultTokens, getComponent } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { rerunRequestSchema } from '@awb/shared/rerun-request'
import { replacementImageSlots, replaceScopedImage } from '../packages/pipeline/src/scoped-rerun'
import { applyPageRewrite } from '../packages/pipeline/src/page-rewrite'
import { pageSchema } from '@awb/website-model'

const hero = getComponent('HeroEditorial')!
const props = { ...hero.fixture as object, heading: 'Original heading', imageUrl: '/original.jpg', imageAlt: 'Original image' }
const page = pageSchema.parse({ id: 'home', path: '/', title: 'Home', h1: 'Original heading', seo: { title: 'Home', description: 'Original business description' }, sections: [{ id: 'hero', componentId: 'HeroEditorial', props }, { id: 'credentials', componentId: 'CredentialsShowcase', props: { items: [{ imageUrl: '/real-award.png' }] } }] })
const model = { tokens: defaultTokens, pages: [page], globalComponents: { header: { componentId: 'HeaderSimple', props: { logoImageUrl: '/logo.png' } }, footer: { props: {} } } } as unknown as WebsiteModel
const snapshot = JSON.stringify(model)
const slots = replacementImageSlots(model)
assert.ok(slots.some(slot => slot.slot === 'home:hero:/imageUrl'))
assert.ok(!slots.some(slot => slot.slot.includes('credentials')))
const next = replaceScopedImage(model, 'home:hero:/imageUrl', '/new.jpg', 'New image')
assert.equal(next.pages[0]!.sections[0]!.props.imageUrl, '/new.jpg')
assert.equal(next.pages[0]!.sections[0]!.props.imageAlt, 'New image')
assert.equal(next.pages[0]!.sections[0]!.props.heading, props.heading)
assert.deepEqual(next.tokens, model.tokens)
assert.deepEqual(next.globalComponents, model.globalComponents)
assert.deepEqual(next.pages[0]!.sections[1], page.sections[1])
assert.equal(JSON.stringify(model), snapshot)
assert.throws(() => replaceScopedImage(model, 'home:missing:/imageUrl', '/bad.jpg', 'Bad'))
const rewritten = applyPageRewrite(pageSchema.parse({ ...page, sections: [page.sections[0]] }), [{ op: 'replace', path: '/sections/0/props/body', value: 'Shorter copy' }])
assert.equal(rewritten.sections[0]!.props.imageUrl, props.imageUrl)
assert.throws(() => applyPageRewrite(rewritten, [{ op: 'replace', path: '/sections/0/props/imageUrl', value: '/bad.jpg' }]))
for (const scope of ['CONTENT', 'IMAGES', 'FULL']) {
  assert.ok(rerunRequestSchema.safeParse({ scope, instruction: 'Make it clearer' }).success)
  assert.ok(!rerunRequestSchema.safeParse({ scope, instruction: '  ' }).success)
}
assert.ok(!rerunRequestSchema.safeParse({ scope: 'CONTENT', instruction: 'Rewrite', imageAssetIds: ['photo'] }).success)
assert.ok(!rerunRequestSchema.safeParse({ scope: 'UPLOADS' }).success)
assert.ok(rerunRequestSchema.safeParse({ scope: 'UPLOADS', logoAssetId: 'logo' }).success)
assert.ok(!rerunRequestSchema.safeParse({ scope: 'IMAGES', instruction: 'New photos', imageAssetIds: Array(11).fill('photo') }).success)
console.log('PASS: scoped rerun validation; images preserve content, palette and logo; copy preserves images; real credentials and source snapshots stay intact.')
