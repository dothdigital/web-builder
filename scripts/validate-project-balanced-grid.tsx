import React from 'react'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import pg from 'pg'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'

async function main() {
  // Existing packages use mixed JSX compiler settings in the standalone harness.
  ;(globalThis as any).React = React
  dotenv.config({ path: '.env', quiet: true })
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const { rows } = await db.query('SELECT model FROM "WebsiteVersion" WHERE "projectId"=$1 ORDER BY version DESC LIMIT 1', ['cmv16xtt2000715nrx0e817em'])
  await db.end()
  assert.ok(rows.length, 'Generated website version exists')
  const model = rows[0].model
  const { chromium } = await import('/tmp/webtummy-layout-preview/node_modules/playwright/index.mjs')
  const browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.route('**/*', route => route.abort())
    let checked = 0
    for (const route of ['/', '/business-insurance/amazon-seller-insurance']) {
      const sourcePage = model.pages.find((entry: any) => entry.path === route)
      assert.ok(sourcePage)
      const html = renderToStaticMarkup(<SiteRenderer model={model} page={sourcePage} baseUrl="" staticExport />)
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.setContent(`<style>body{margin:0}*{box-sizing:border-box}</style>${html}`)
        const grids = await page.locator('[id^="awb-grid-"]').evaluateAll(elements => elements.filter(el => el.children.length === 4 && Array.from(el.children).some(child => child.hasAttribute('data-awb-element'))).map(el => {
          const rows: Record<string, number> = {}
          Array.from(el.children).forEach(child => { const top = child.getBoundingClientRect().top; rows[top] = (rows[top] || 0) + 1 })
          return { rows: Object.values(rows), width: el.getBoundingClientRect().width, section: el.closest('[data-component-id]')?.getAttribute('data-component-id'), text: el.textContent?.slice(0, 80) }
        }))
        console.log(JSON.stringify({ route, width, grids }))
        for (const grid of grids) {
          if (grid.section === 'AboutSplitOverlap' && !sourcePage.sections.some((section: any) => section.props.layout === 'cards' && grid.text?.startsWith(section.props.points?.[0]?.title))) continue
          assert.deepEqual(grid.rows, width === 1440 ? [2, 2] : [1, 1, 1, 1], `${route} at ${width}px`)
          checked++
        }
      }
    }
    assert.ok(checked > 0, 'Checked real four-card website sections')
    console.log(`Passed ${checked} real website grid checks on homepage and Amazon seller page.`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
