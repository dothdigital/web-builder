import assert from 'node:assert/strict'
import { allowsPersonalPhoto, removeMisplacedPersonalPhotos } from '../packages/pipeline/src/personal-photo-policy'
import type { WebsiteModel } from '@awb/website-model'
const section = (id: string, heading: string) => ({ id, hidden: false, componentId: 'AboutSplitOverlap', props: { heading, imageUrl: 'portrait', items: [{ imageUrl: 'portrait' }] } })
const model = { pages: [
  { id: 'home', path: '/', sections: [section('hero', 'Planning with Rupinder Singh'), section('about', 'About Secure Path'), section('approach', 'Our approach'), section('service-areas', 'Serving Ontario'), section('services', 'Services')] },
  { id: 'about', path: '/about', sections: [section('about-hero', 'About Rupinder Singh'), section('who-we-are', 'Who we are'), section('rupinder-photos', 'Meet Rupinder Singh'), section('services', 'Services')] },
  { id: 'product', path: '/services/life', sections: [section('hero', 'Meet your advisor')] },
], globalComponents: { header: { props: { imageUrl: 'portrait' } } } } as unknown as WebsiteModel
assert.equal(allowsPersonalPhoto(model, 'home:hero:/imageUrl'), true)
for (const slot of ['home:approach:/imageUrl', 'home:service-areas:/imageUrl', 'home:services:/items/0/imageUrl', 'home:about:/imageUrl', 'product:hero:/imageUrl', 'about:rupinder-photos:/imageUrl']) assert.equal(allowsPersonalPhoto(model, slot), false, slot)
removeMisplacedPersonalPhotos(model, new Set(['portrait']))
assert.equal(model.pages[0].sections[0].props.imageUrl, 'portrait')
assert.equal(model.pages[1].sections[0].props.imageUrl, 'portrait')
assert.equal((JSON.stringify(model).match(/portrait/g) ?? []).length, 2)
console.log('Personal photo policy: introduction only, duplicate and nested placements removed, service pages excluded.')
