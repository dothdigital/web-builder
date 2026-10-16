import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { getComponent, defaultTokens, tokensToCssVars } from '@awb/component-registry'
Object.assign(globalThis, { React })
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const directory = await mkdtemp(`${tmpdir()}/inner-heroes-`)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
try {
  const page = await browser.newPage()
  for (const id of ['HeroEditorial', 'HeroTypographic', 'HeroSplitBooking']) {
    const definition = getComponent(id)!
    const imageUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1600"><rect width="400" height="1600" fill="#123456"/></svg>').toString('base64')
    const props = definition.propsSchema.parse({ ...definition.fixture, imageUrl })
    const Component = definition.render
    const render = (path?: string, overrides = {}) => renderToStaticMarkup(React.createElement('div', { style: tokensToCssVars(defaultTokens) }, React.createElement(Component, { props: { ...props, ...overrides }, context: { tokens: defaultTokens, baseUrl: '', pagePath: path } })))
    assert.equal(render('/'), render(), `${id}: homepage markup remains unchanged`)
    const html = render('/services/test')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.setContent(html)
      const image = page.locator('img[data-awb-element="/imageUrl"]')
      const height = await image.evaluate(element => element.getBoundingClientRect().height)
      assert.ok(height >= 220 && height <= 361, `${id} at ${width}: image height ${height}`)
      assert.equal(await image.evaluate(element => getComputedStyle(element).objectFit), 'contain')
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.setContent(render('/services/test', { imageSizes: { '/imageUrl': { height: 480, fit: 'cover' } } }))
    assert.equal(await page.locator('img').evaluate(element => element.getBoundingClientRect().height), 480, 'Explicit image sizing remains available')
    await page.setContent(render('/services/test', { imageLayout: 'background' }))
    const backgroundHeight = await page.locator('section').evaluate(element => element.getBoundingClientRect().height)
    assert.ok(backgroundHeight < 600, `${id}: compact background hero ${backgroundHeight}`)
    await writeFile(`${directory}/${id}.html`, html)
  }
  console.log('PASS: all three shared heroes have compact inner-page images on desktop/mobile, preserve homepage markup and manual image sizes, and reduce background hero height.')
} finally {
  await browser.close()
  await rm(directory, { recursive: true, force: true })
}
