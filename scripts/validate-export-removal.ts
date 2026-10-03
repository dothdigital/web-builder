import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultTokens, getComponent } from '@awb/component-registry'
Object.assign(globalThis, { React })
const definition = getComponent('AboutSplitOverlap')!
const props = definition.propsSchema.parse({ ...definition.fixture as object, removedElements: ['/heading'] })
const original = React.useId
try {
  React.useId = () => { throw new Error('Static export must not call useId') }
  const render = (scope: string) => renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '', staticRenderScope: scope } }))
  const first = render('section-one')
  const second = render('section-two')
  const firstId = first.match(/id="(awb-static-[^"]+)"/)![1]
  const secondId = second.match(/id="(awb-static-[^"]+)"/)![1]
  assert.notEqual(firstId, secondId, 'Deletion CSS is isolated by section')
  assert.ok(first.includes(`#${firstId} [data-awb-element="/heading"]{display:none!important}`))
  assert.equal(render('section-one'), first, 'Stable output across repeated exports')
} finally { React.useId = original }
console.log('PASS: deleted elements export without hooks, with stable independent section scopes.')
