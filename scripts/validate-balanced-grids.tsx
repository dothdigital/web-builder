import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BalancedGrid } from '../packages/component-registry/src/balanced-grid'
import { portfolioShowcase } from '../packages/component-registry/src/components/showcase'

async function main() {
  const { chromium } = await import('/tmp/webtummy-layout-preview/node_modules/playwright/index.mjs')
  const browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    for (const width of [1100, 560, 320]) {
      for (let count = 1; count <= 12; count++) {
        const html = renderToStaticMarkup(<div style={{ width }}><BalancedGrid count={count} minimumWidth={200} gap="1rem">{Array.from({ length: count }, (_, index) => <article key={index} style={{ minHeight: 80, border: '1px solid black', boxSizing: 'border-box' }}>Card {index + 1}</article>)}</BalancedGrid></div>)
        await page.setContent(html)
        const rows = await page.locator('article').evaluateAll(cards => {
          const rows: Record<string, number> = {}
          for (const card of cards) {
            const box = card.getBoundingClientRect()
            rows[box.top] = (rows[box.top] || 0) + 1
            if (box.right > card.parentElement!.getBoundingClientRect().right + 1) throw new Error('Grid overflow')
          }
          return Object.values(rows)
        })
        const columns = width === 1100 ? 3 : width === 560 ? 2 : 1
        assert.ok(rows.every(size => size <= columns), `${width}px ${count}: too many columns`)
        assert.ok(Math.max(...rows) - Math.min(...rows) <= 1, `${width}px ${count}: unbalanced rows ${rows}`)
        if (count === 4 && columns >= 2) assert.deepEqual(rows, [2, 2])
        if (count === 7 && columns === 3) assert.deepEqual(rows, [3, 2, 2])
        if (count === 5 && columns === 3) assert.deepEqual(rows, [3, 2])
      }
    }
    const Portfolio = portfolioShowcase.render
    const props = portfolioShowcase.propsSchema.parse({ layout: 'grid', items: Array.from({ length: 7 }, (_, i) => ({ title: `Project ${i}`, category: i < 4 ? 'Canada' : 'Ontario' })) })
    await page.setContent(renderToStaticMarkup(<div style={{ width: 1200 }}><Portfolio props={props} context={{ editing: false, baseUrl: '', tokens: {} as any }} /></div>))
    await page.getByText('Canada', { exact: true }).first().click()
    const filtered = await page.locator('.awb-project-card:visible').evaluateAll(cards => {
      const rows: Record<string, number> = {}
      cards.forEach(card => { const top = card.getBoundingClientRect().top; rows[top] = (rows[top] || 0) + 1 })
      return Object.values(rows)
    })
    assert.deepEqual(filtered, [2, 2], 'Filtering to four portfolio cards must rebalance to 2 × 2')
    console.log('Passed 36 responsive layout cases and filtered portfolio balancing.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
