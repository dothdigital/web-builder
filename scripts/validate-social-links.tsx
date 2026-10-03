import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SocialLink, uniqueSocialLinks } from '../packages/component-registry/src/components/social-link'
Object.assign(globalThis, { React })
const platforms = ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok']
const links = platforms.map(platform => ({ platform, href: 'https://fb.com' }))
assert.equal(uniqueSocialLinks(links).length, 6)
assert.equal(uniqueSocialLinks([...links, { platform: ' FACEBOOK ', href: 'https://fb.com/' }]).length, 6)
for (const [index, name] of ['Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'TikTok'].entries()) {
  assert.ok(renderToStaticMarkup(<SocialLink {...links[index]!} />).includes(`aria-label="${name}"`))
}
assert.ok(renderToStaticMarkup(<SocialLink platform="" href="https://instagram.com/example" />).includes('aria-label="Instagram"'))
console.log('PASS: distinct platform icons survive repeated URLs; exact profile duplicates removed; URL detection remains available.')

assert.equal(renderToStaticMarkup(<SocialLink platform="facebook" href="" />), '')
assert.equal(renderToStaticMarkup(<SocialLink platform="instagram" href="   " />), '')
assert.deepEqual(uniqueSocialLinks([{ platform: 'facebook', href: '' }, { platform: 'instagram', href: '  ' }, { platform: 'linkedin', href: 'https://linkedin.com/company/example' }]), [{ platform: 'linkedin', href: 'https://linkedin.com/company/example' }])
console.log('PASS: empty and whitespace-only links render no social icon.')
