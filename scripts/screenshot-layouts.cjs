const fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const sharp = require('sharp')
const layouts = require('../packages/shared/src/layout-catalogue.json')
;(async () => {
  const target = path.resolve(__dirname, '../apps/web/public/template-library/thumbnails')
  fs.mkdirSync(target, { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN} : {}),args:['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1080}, reducedMotion:'reduce' })
    for(const layout of layouts){
      await page.goto(`${process.env.WEB_PREVIEW_URL || 'http://127.0.0.1:3000'}${layout.preview}`,{waitUntil:'load'})
      await page.locator('img').evaluateAll(images=>images.forEach(image=>image.loading='eager'))
      await page.waitForLoadState('networkidle')
      await page.addStyleTag({content:'#pre-load,.loader-wrapper,.preloader,.loader-container{display:none!important}.wow{visibility:visible!important;opacity:1!important}'})
      const screenshot = await page.screenshot()
      await sharp(screenshot).resize(720,540).webp({quality:85}).toFile(path.join(target,`${layout.id}.webp`))
      console.log('Thumbnail',layout.id)
    }
  } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1})
