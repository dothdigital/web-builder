import assert from 'node:assert/strict'
import type { ImageSlotRequest } from '@awb/ai'
import { prioritizeImageSlots } from '../packages/pipeline/src/image-plan'
const slot = (page: string, section: string, family: string, field = 'imageUrl') => ({ slot: `${page}:${section}:/${field}`, pageTitle: page, componentId: section, family }) as ImageSlotRequest
const slots = [slot('home', 'hero', 'HERO'), slot('home', 'options', 'ABOUT'), slot('home', 'experience', 'ABOUT'), slot('home', 'contact', 'CONTACT'), slot('home', 'optional', 'ABOUT', 'image1'), ...Array.from({ length: 11 }, (_, index) => slot(`service-${index}`, 'hero', 'HERO'))]
const selected = prioritizeImageSlots(slots, 10)
for (const required of slots.filter(item => item.slot.endsWith(':/imageUrl'))) assert.ok(selected.includes(required), `Missing required image: ${required.slot}`)
assert.ok(!selected.some(item => item.slot.endsWith(':/image1')), 'Decorative extras must not crowd out required images')
assert.equal(new Set(selected.map(item => item.slot)).size, selected.length)
assert.deepEqual(prioritizeImageSlots([], 10), [])
console.log('PASS: homepage content and contact images retain coverage alongside inner-page heroes; decorative images remain lower priority.')
