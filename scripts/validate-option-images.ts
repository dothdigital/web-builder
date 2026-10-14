import assert from 'node:assert/strict'
import { emptyImagePointers } from '@awb/component-registry'
import { prioritizeImageSlots } from '../packages/pipeline/src/image-plan'
import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
import type { ImageSlotRequest } from '@awb/ai'

const props = { heading: 'Hot or cold', items: [{ title: 'Hot', imageUrl: '', imageAlt: 'Warm cup' }, { title: 'Cold', imageUrl: '', imageAlt: 'Chilled glass' }] }
assert.deepEqual(emptyImagePointers('ServicesAlternatingShowcase', props), ['/items/0/imageUrl', '/items/1/imageUrl'])
assert.deepEqual(emptyImagePointers('ServicesLargeNumbers', { ...props, items: [{ title: 'Hot', imageUrl: 'hot.png' }, props.items[1]] }), ['/items/1/imageUrl'])
assert.deepEqual(emptyImagePointers('PortfolioShowcase', props), [])
assert.deepEqual(emptyImagePointers('CredentialsShowcase', props), [])
const slot = (value: string): ImageSlotRequest => ({ slot: value, pageTitle: 'Products', componentId: 'ServicesAlternatingShowcase', family: 'SERVICES' })
const slots = ['home:hero:/imageUrl', 'home:extra:/imageUrl', 'detail:hero:/imageUrl', 'detail:options:/items/0/imageUrl', 'detail:options:/items/1/imageUrl'].map(slot)
assert.deepEqual(prioritizeImageSlots(slots, 4).map(s => s.slot), [slots[0]!.slot, slots[2]!.slot, slots[3]!.slot, slots[4]!.slot])
assert.deepEqual(prioritizeImageSlots(slots, 3).map(s => s.slot), [slots[0]!.slot, slots[2]!.slot, slots[1]!.slot], 'Do not generate only half of an option set')
const hero = { id: 'hero', componentId: 'HeroEditorial', props: { imageUrl: 'hero.png', imageAlt: 'Hero' } }
const section = { id: 'options', componentId: 'ServicesAlternatingShowcase', props }
const page = { id: 'detail', path: '/chai', title: 'Chai', sections: [hero, section] }
const model = { pages: [page] }
const resolved = resolveSectionMedia(model as any, page as any, section as any).items as any[]
assert.ok(resolved.every(item => !item.imageUrl), 'Distinct options must not reuse the hero')
assert.deepEqual(resolved.map(item => item.imageAlt), ['Warm cup', 'Chilled glass'])
const linked = { ...section, props: { items: [{ title: 'Chai', href: '/chai' }, { title: 'Hot', imageUrl: 'hot.png' }, { title: 'Cold', imageUrl: 'cold.png' }] } }
const linkedItems = resolveSectionMedia(model as any, page as any, linked as any).items as any[]
assert.equal(linkedItems[0].imageUrl, 'hero.png', 'A linked product may use its own destination cover')
assert.deepEqual(linkedItems.slice(1).map(item => item.imageUrl), ['hot.png', 'cold.png'])
console.log('Passed option slot discovery, generation priority, budget, and media fallback checks.')
