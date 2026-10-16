import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import { encode } from 'next-auth/jwt'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const projectId = JSON.parse(readFileSync('/tmp/webtummy-support-demo.json','utf8')).projectId
const output = 'apps/web/public/support'
mkdirSync(output, { recursive: true })
const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: { include: { members: { include: { user: true } } } } } })
const user = project.workspace.members.find(member => member.role === 'OWNER')!.user
if (user.isPlatformAdmin || user.isPlatformSupport || project.name !== 'Willow Studio') throw new Error('Documentation captures must use the isolated normal-customer Willow Studio demo')
const salt = '__Secure-authjs.session-token'
const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 1200 })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
const blocked: string[] = []
await context.route('**/*', async route => {
 if (!['GET','HEAD'].includes(route.request().method())) { blocked.push(new URL(route.request().url()).pathname); return route.abort() }
 return route.continue()
})
const page = await context.newPage()
page.setDefaultTimeout(12000)
const sharp = (await import('sharp')).default
const captured: string[] = []
async function shot(name: string, target?: any) {
 await page.waitForTimeout(350)
 await page.waitForTimeout(250)
 const buffer = await (target ?? page).screenshot({type:'png', animations:'disabled', mask: [page.locator('input[type=password]')]})
 await sharp(buffer).webp({quality:85}).toFile(`${output}/${name}.webp`)
 captured.push(name); console.log(`Captured ${name}`)
}
async function editor() {
 await page.goto(`https://webtummy.com/projects/${projectId}/editor`)
 await page.locator('[data-awb-section-id]').first().waitFor(); await page.waitForTimeout(600)
}
async function selectText() {
 await page.locator('[data-awb-section-id="hero"] h1[data-awb-element]').first().click()
 await page.getByRole('toolbar',{name:'text controls',exact:true}).waitFor()
 return page.getByRole('toolbar',{name:'text controls',exact:true})
}
try {
 await editor(); await shot('editor-overview')
 await page.getByRole('button',{name:/Select page:/}).first().click(); await shot('page-picker'); await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'+ Blog / Page',exact:true}).click()
 await page.getByRole('dialog').locator('select').first().selectOption('page'); await shot('create-page')
 await page.getByRole('dialog').locator('select').first().selectOption('blog')
 await page.getByLabel('Add an AI-generated blog cover',{exact:true}).check(); await shot('create-blog')
 await page.getByRole('button',{name:'Close creation form',exact:true}).click()
 await page.getByRole('button',{name:'+ Add section',exact:true}).click(); await shot('add-section')
 await page.getByRole('button',{name:'I choose layout',exact:true}).click(); await shot('section-layouts')
 await editor(); await page.getByRole('button',{name:'+ Add object',exact:true}).click(); await shot('add-object')
 await page.getByRole('button',{name:'Close add object',exact:true}).click()
 await page.getByRole('button',{name:/Section 1 ·/}).click(); await shot('section-properties')
 const toolbar = await selectText(); await shot('text-toolbar')
 await toolbar.getByRole('button',{name:'Spacing',exact:true}).click(); await shot('object-spacing')
 await toolbar.getByRole('button',{name:'Borders',exact:true}).click(); await shot('object-borders')
 await toolbar.getByRole('button',{name:'Layout',exact:true}).click(); await shot('object-layout')
 await toolbar.getByRole('button',{name:'Move into section…',exact:true}).click(); await shot('move-object')
 await editor()
 await page.locator('[data-awb-section-id="hero"] img[data-awb-element]').first().click()
 const imageBar = page.getByRole('toolbar',{name:'image controls',exact:true})
 await imageBar.getByRole('button',{name:'Replace image',exact:true}).click(); await shot('replace-image')
 await imageBar.getByRole('button',{name:'Update with AI',exact:true}).click(); await shot('ai-image')
 await editor()
 await page.locator('[data-awb-section-id="hero"] img[data-awb-element]').first().click()
 await page.getByRole('toolbar',{name:'image controls',exact:true}).getByRole('button',{name:'Size',exact:true}).click(); await shot('image-size')
 await editor(); await page.getByRole('button',{name:'page',exact:true}).click(); await shot('page-properties')
 await page.getByLabel('Page title',{exact:true}).scrollIntoViewIfNeeded(); await shot('page-seo')
 await page.getByRole('button',{name:'theme',exact:true}).click(); await shot('theme')
 await page.getByRole('button',{name:'integrations',exact:true}).click(); await shot('integrations')
 await editor(); await page.getByRole('button',{name:'✦ AI Assistant',exact:true}).click(); await shot('ai-assistant')
 await page.getByRole('button',{name:'Assistant add menu',exact:true}).click(); await shot('assistant-add')
 await editor(); await page.getByRole('button',{name:'mobile',exact:true}).click(); await shot('mobile-preview')
 await page.getByRole('button',{name:'Focus canvas',exact:true}).click(); await shot('focus-canvas')
 await page.goto('https://webtummy.com/dashboard'); await page.locator('.wt-site-card').first().waitFor()
 await shot('dashboard')
 await page.getByRole('button',{name:'Rerun with AI',exact:true}).click(); await shot('rerun-ai')
 await page.goto(`https://webtummy.com/projects/${projectId}/publishing`); await page.getByText('Hosting status',{exact:true}).waitFor();
 await shot('publishing')
 await page.goto(`https://webtummy.com/projects/${projectId}/analytics`); await page.getByRole('heading',{name:/Analytics/}).waitFor();
 // Reports may contain visitor information; capture only the source and range controls.
 await shot('analytics',page.locator('main > div').first())
 await editor(); await page.getByRole('button',{name:'+ Add object',exact:true}).click()
 await page.getByRole('button',{name:'Form',exact:true}).click(); await shot('form-properties')
 await editor(); await page.getByRole('button',{name:'+ Add section',exact:true}).click()
 await page.getByRole('button',{name:'+ Blank section — build without AI',exact:true}).click(); await shot('blank-section')
 await editor(); await page.locator('[data-awb-section-id="hero"] h1[data-awb-element]').first().click()
 await page.locator('[data-awb-section-id="hero"] p[data-awb-element]').first().click({modifiers:['Shift']})
 await page.getByRole('toolbar',{name:'Multiple object controls',exact:true}).waitFor(); await shot('multi-select')
 await editor(); await page.locator('[data-awb-section-id="hero"] a[data-awb-element]').first().click()
 const buttonBar=page.getByRole('toolbar',{name:'button controls',exact:true})
 await buttonBar.getByRole('button',{name:'Edit text / link',exact:true}).click(); await shot('button-link')
 await editor(); await page.locator('[data-awb-section-id="hero"] img[data-awb-element]').first().click()
 const libraryBar=page.getByRole('toolbar',{name:'image controls',exact:true})
 await libraryBar.getByRole('button',{name:'Replace image',exact:true}).click()
 await libraryBar.getByRole('button',{name:/Choose from image library/}).click(); await shot('image-library')
 await editor(); await page.getByRole('button',{name:'theme',exact:true}).click()
 await page.getByText('Palette',{exact:true}).scrollIntoViewIfNeeded(); await shot('theme-palette')
 await page.getByText('Typography',{exact:true}).scrollIntoViewIfNeeded(); await shot('theme-typography')
 await editor(); await page.locator('#editor-left-panel').getByRole('button',{name:'Split navigation with utility bar',exact:true}).click(); await shot('header-properties')
 await page.goto('https://webtummy.com/account'); await page.getByRole('heading',{name:'Profile',exact:true}).waitFor()
 await shot('account')
 await page.goto('https://webtummy.com/billing'); await page.getByRole('heading',{name:'Plans & billing',exact:true}).waitFor(); await shot('billing')
 await page.goto('https://webtummy.com/onboarding'); await page.getByRole('heading').first().waitFor(); await shot('new-website')
 writeFileSync(`${output}/capture-manifest.json`, JSON.stringify({capturedAt:new Date().toISOString(),screenshots:captured,notes:'Actual product UI in the isolated Willow Studio demo website with a normal customer account; no admin/support flags. No save, publish or generation submitted.'},null,2))
 console.log(`Done: ${captured.length} screenshots; ${blocked.length} non-GET requests blocked`)
} finally { await browser.close(); await prisma.$disconnect() }
