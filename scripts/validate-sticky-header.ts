import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'
Object.assign(globalThis, { React })
for (const componentId of ['HeaderTransparent', 'HeaderSplitUtility']) for (const sticky of [true, false]) {
  const header = getComponent(componentId)!
  const footer = getComponent('FooterCompact')!
  const model = { tokens: defaultTokens, contact: {}, socials: [], pages: [{ id: 'home', title: 'Home', path: '/', sections: [] }], globalComponents: { header: { componentId, props: { ...(header.fixture as object), sticky, sectionBackgroundMode: 'colour', sectionBackgroundColor: '#123456' } }, footer: { componentId: footer.componentId, props: footer.fixture } } } as unknown as WebsiteModel
  const html = renderToStaticMarkup(React.createElement(SiteRenderer, { model, page: model.pages[0]!, baseUrl: '' }))
  assert.equal(html.includes(`style="position:sticky;top:0;z-index:50" data-component-id="${componentId}"`), sticky)
  assert.ok(html.includes('background:#123456'))
}
console.log('PASS: both headers place sticky positioning on their outer page wrapper, respect the off setting and render the chosen background colour.')
