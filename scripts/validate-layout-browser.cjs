const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { build } = require('esbuild')
let playwright
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright') }
catch { playwright = require('/tmp/webtummy-layout-preview/node_modules/playwright') }
const { chromium } = playwright
const layouts = require('../packages/shared/src/layout-catalogue.json')
const root = path.resolve(__dirname, '..')
const output = '/tmp/webtummy-layout-validation'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' }
async function main() {
  const result = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {LayoutGallery} from './apps/web/src/components/account/layout-gallery';
    import {getComponent,defaultTokens} from '@awb/component-registry';
    import {editObjectProps} from './apps/web/src/lib/object-editing';
    window.React=React;
    createRoot(document.getElementById('root')).render(<LayoutGallery onSelect={id=>{document.getElementById('selected').textContent=id || 'custom'}}/>);
    const editor=createRoot(document.getElementById('editor'));
    function Fixture({section,field}) {
      const [props,setProps]=React.useState(section.props); const definition=getComponent(section.componentId);
      const Component=definition.render;
      return <><label>Editable value<input id="edit-value" value={String(props[field.path.slice(1)] || '')} onChange={event=>setProps(editObjectProps(props,field.path,{type:'content',pointer:field.path,value:event.target.value}))}/></label><div id="edited-output"><Component props={definition.propsSchema.parse(props)} context={{tokens:defaultTokens,baseUrl:'',editing:true}}/></div></>;
    }
    window.openEditor=(section,field)=>editor.render(<Fixture key={section.componentId+field.path} section={section} field={field}/>);
  `, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, outfile: 'gallery.js', loader: { '.css': 'local-css' }, define: { 'process.env.NODE_ENV': '"production"' } })
  for (const file of result.outputFiles) await fs.writeFile(path.join(output, path.basename(file.path)), file.contents)
  await fs.writeFile(path.join(output, 'gallery.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="gallery.css"></head><body><div id="sentinel" style="font-size:19px;color:rgb(23,45,67)">Application sentinel</div><div id="root"></div><output id="selected"></output><div id="editor"></div><script src="gallery.js"></script></body></html>')
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const directory = pathname.startsWith('/template-library/') ? path.join(root, 'apps/web/public') : output
      let filename = path.resolve(directory, `.${pathname}`)
      if (!filename.startsWith(`${directory}/`)) throw new Error('Invalid path')
      if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html')
      const type = mime[path.extname(filename)] || 'application/octet-stream'
      res.setHeader('Content-Type', type.startsWith('text/') ? `${type}; charset=utf-8` : type)
      res.end(await fs.readFile(filename))
    } catch { res.statusCode = 404; res.end('Not found') }
  })
  await new Promise(resolve => server.listen(3010, '127.0.0.1', resolve))
  const cachedChrome = '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
  const executablePath = process.env.CHROMIUM_PATH || (require('node:fs').existsSync(cachedChrome) ? cachedChrome : undefined)
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] })
  const results = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    const failures = []
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:3010')) failures.push(response.url()) })
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3010') || route.request().url().startsWith('data:') ? route.continue() : route.abort())
    await page.goto('http://127.0.0.1:3010/gallery.html')
    await page.locator('article').last().waitFor()
    assert.equal(await page.locator('article').count(), 18)
    await page.locator('article img').evaluateAll(images => images.forEach(img => { img.loading = 'eager' }))
    await page.waitForFunction(() => [...document.querySelectorAll('article img')].every(img => img.complete && img.naturalWidth))
    assert.equal(await page.locator('article img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).length), 0)
    for (const layout of layouts) {
      await page.getByRole('button', { name: `Preview ${layout.name}`, exact: true }).click()
      await page.locator('dialog iframe').waitFor()
      assert.equal(await page.locator('dialog iframe').getAttribute('src'), layout.preview)
      const frame = page.frames().find(frame => frame.url().endsWith(layout.preview))
      if (frame) await frame.waitForLoadState('load')
      await page.getByRole('button', { name: 'Mobile', exact: true }).click()
      assert.ok((await page.locator('dialog iframe').boundingBox()).width <= 400)
      await page.getByRole('button', { name: 'Desktop', exact: true }).click()
      assert.ok((await page.locator('dialog iframe').boundingBox()).width > 400)
      await page.locator('dialog').getByRole('button', { name: 'Use this layout', exact: true }).click()
      assert.equal(await page.locator('#selected').textContent(), layout.id)
    }
    for (const category of [...new Set(layouts.map(layout => layout.category))]) {
      await page.getByRole('button', { name: category, exact: true }).click()
      assert.equal(await page.locator('article').count(), layouts.filter(layout => layout.category === category).length)
    }
    await page.getByRole('button', { name: 'All layouts', exact: true }).click()
    await page.getByRole('button', { name: 'Create a custom design' }).click()
    assert.equal(await page.locator('#selected').textContent(), 'custom')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile gallery overflow')
    for (const layout of layouts) {
      await page.goto('http://127.0.0.1:3010/gallery.html')
      const model = JSON.parse(await fs.readFile(path.join(output, `${layout.id}.json`), 'utf8'))
      const definitions = require('../packages/component-registry/src/imported/layouts.json').sections
      for (const type of ['text','image','link']) {
        const section = model.pages[0].sections.find(section => !section.hidden && definitions.find(definition => definition.componentId === section.componentId).fields.some(field => field.type === type))
        const fields = definitions.find(definition => definition.componentId === section.componentId).fields
        const field = type === 'text' ? fields.find(field => field.type === type && field.headingLevel === 1) || fields.find(field => field.type === type) : fields.find(field => field.type === type)
        await page.evaluate(({section,field}) => window.openEditor(section,field), { section, field })
        const value = type === 'image' ? layout.thumbnail : type === 'link' ? '/contact' : 'Browser edited Cedar content'
        await page.locator('#edit-value').fill(value)
        if (type === 'text') await page.getByText(value, { exact: true }).waitFor()
        else if (type === 'link') assert.ok(await page.locator('#edited-output a[href="/contact"]').count())
        else assert.ok(await page.locator('#edited-output').evaluate((el,value) => [...el.querySelectorAll('img')].some(img => img.getAttribute('src') === value) || [...el.querySelectorAll('[style]')].some(node => node.style.backgroundImage.includes(value)), value))
      }
      const measurements = []
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`http://127.0.0.1:3010/${layout.id}/`, { waitUntil: 'load' })
        await page.addStyleTag({ content: 'body{margin:0}' })
        await page.evaluate(() => { const sentinel = document.createElement('p'); sentinel.id = 'sentinel'; sentinel.textContent = 'Application sentinel'; document.body.append(sentinel) })
        const before = await page.locator('#sentinel').evaluate(el => ({ font: getComputedStyle(el).fontSize, color: getComputedStyle(el).color, margin: getComputedStyle(el).margin }))
        await page.evaluate(() => document.querySelectorAll('link[href*="editable.css"]').forEach(el => el.remove()))
        const after = await page.locator('#sentinel').evaluate(el => ({ font: getComputedStyle(el).fontSize, color: getComputedStyle(el).color, margin: getComputedStyle(el).margin }))
        assert.deepEqual(before, after, `${layout.id}: imported CSS leaked outside its wrapper`)
        await page.reload({ waitUntil: 'load' })
        await page.addStyleTag({ content: 'body{margin:0}' })
        await page.locator('img').evaluateAll(images => images.forEach(img => { img.loading = 'eager' }))
        await page.waitForFunction(() => [...document.images].every(img => img.complete))
        const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, height: document.body.scrollHeight, headings: [...document.querySelectorAll('h1')].filter(el => el.textContent.trim()).map(el => el.textContent.trim()), brokenImages: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src) }))
        assert.ok(dimensions.scroll <= width + 1, `${layout.id} ${width}px overflow: ${dimensions.scroll}`)
        assert.equal(dimensions.headings.length, 1, `${layout.id}: one visible H1`)
        assert.deepEqual(dimensions.brokenImages, [], `${layout.id}: broken images`)
        await page.screenshot({ path: path.join(output, `${layout.id}-${width}.png`), fullPage: true })
        measurements.push(dimensions)
      }
      results.push({ id: layout.id, measurements, status: 'passed' })
      console.log(`PASS ${layout.id}: gallery preview/selection, desktop/mobile rendering, CSS isolation`)
    }
    assert.deepEqual([...new Set(failures)], [], 'Missing local preview or generated assets')
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
    await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ complete: results.length === 18, results }, null, 2))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
