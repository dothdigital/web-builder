import React from 'react'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import pg from 'pg'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'

async function main() {
;(globalThis as any).React = React
dotenv.config({ path: '.env', quiet: true })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const { rows } = await db.query('SELECT model FROM "WebsiteVersion" WHERE "projectId"=$1 ORDER BY version DESC LIMIT 1', ['cmv71kb0n000bngnr24e37ve7'])
await db.end()
const model = rows[0].model
const { chromium } = await import('/tmp/webtummy-layout-preview/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  await page.route('**/*', route => route.abort())
  for (const path of ['/products', '/products/chai-tea-latte']) {
    const source = model.pages.find((p: any) => p.path === path)
    const html = renderToStaticMarkup(<SiteRenderer model={model} page={source} baseUrl="" staticExport />)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.setContent(`<style>body{margin:0}*{box-sizing:border-box}</style>${html}`)
      if (path === '/products') {
        const card = page.locator('#flagship-mix [data-awb-element="/items/0"]')
        const geometry = await card.evaluate(el => {
          const image = el.querySelector('img')!
          const text = image.nextElementSibling!
          return { image: image.getBoundingClientRect().toJSON(), text: text.getBoundingClientRect().toJSON() }
        })
        assert.ok(geometry.image.height <= 320)
        if (width === 1440) assert.ok(geometry.image.right <= geometry.text.left + 1, 'Desktop image and text sit side by side')
        else assert.ok(geometry.image.bottom <= geometry.text.top + 1, 'Mobile image stacks above copy')
      } else {
        for (const selector of ['#hot-or-cold [data-awb-element="/items/0/title"]', '#hot-or-cold [data-awb-element="/items/0/description"]']) {
          assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)', 'Showcase copy inherits white section text')
        }
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
      await page.screenshot({ path: `/tmp/chai-${path === '/products' ? 'products' : 'detail'}-${width}.png`, fullPage: true })
      console.log(`Passed ${path} at ${width}px`)
    }
  }
} finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
