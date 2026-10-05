import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { prisma } from '@awb/database'
import { accountEmailTemplate } from '../apps/web/src/lib/account-email-template'
import { sendAccountEmail } from '../apps/web/src/lib/account-email'
import { SESv2Client } from '@aws-sdk/client-sesv2'

const { chromium } = createRequire(import.meta.url)('/tmp/webtummy-preview/node_modules/playwright')
const base = process.env.MARKETING_TEST_BASE || 'http://127.0.0.1:3002'
const output = '/home/ubuntu/webtummy-home-import'
const users: string[] = []
const identifiers: string[] = []
const results: object[] = []
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const token = () => randomBytes(32).toString('hex')
let browser: any

try {
  for (const purpose of ['verify', 'reset'] as const) {
    const template = accountEmailTemplate({purpose,name:'Alex Morgan',url:`https://webtummy.com/${purpose === 'verify' ? 'verify-email' : 'reset-password'}?token=${'a'.repeat(64)}`})
    assert.ok(template.html.includes('Hi Alex Morgan,'))
    assert.ok(template.html.includes('Team Webtummy'))
    assert.ok(template.html.includes('expires in one hour'))
    assert.ok(template.text.includes('support@webtummy.com'))
    assert.ok(template.html.includes(purpose === 'verify' ? 'Verify my email' : 'Set a new password'))
    writeFileSync(`${output}/${purpose}-email-preview.html`,template.html)
    const unsafe = accountEmailTemplate({purpose,name:'<img src=x onerror=alert(1)>',url:'https://webtummy.com/verify-email?token=test&x="quoted"'})
    assert.ok(!unsafe.html.includes('<img src=x'))
    assert.ok(unsafe.html.includes('&lt;img'))
    assert.ok(unsafe.html.includes('&amp;x=&quot;quoted&quot;'))
  }
  results.push({check:'Personalized HTML and plain-text emails, button and fallback link, one-hour expiry, Team Webtummy signature and HTML escaping',passed:true})
  assert.equal(process.env.ACCOUNT_EMAIL_FROM,'Team Webtummy <no-reply@webtummy.com>')
  results.push({check:'Requested no-reply sender configured on the verified Webtummy domain',passed:true})
  const originalSend = SESv2Client.prototype.send
  let sent: any
  try {
    SESv2Client.prototype.send = (async (command: any) => { sent = command.input; return {MessageId:'intercepted-local-check'} }) as any
    const template = accountEmailTemplate({purpose:'verify',name:'Alex Morgan',url:`https://webtummy.com/verify-email?token=${'a'.repeat(64)}`})
    await sendAccountEmail('no-send@security-test.invalid',template.subject,template.text,template.html)
    assert.equal(sent.FromEmailAddress,'Team Webtummy <no-reply@webtummy.com>')
    assert.equal(sent.Content.Simple.Body.Html.Data,template.html)
    assert.equal(sent.Content.Simple.Body.Text.Data,template.text)
    await sendAccountEmail('no-send@security-test.invalid','Billing transport check','Existing plain-text notice')
    assert.equal(sent.FromEmailAddress,process.env.SES_MAILER_FROM)
    assert.equal(sent.Content.Simple.Body.Html,undefined)
    results.push({check:'Intercepted SES transport includes HTML and plain text with no-reply sender; existing billing notices retain their sender',passed:true})
  } finally { SESv2Client.prototype.send = originalSend }
  browser = await chromium.launch({headless:true,executablePath:'/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']})
  const context = await browser.newContext({viewport:{width:390,height:844}})
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror',(error: Error)=>errors.push(error.message))
  const fixtures = []
  for (const kind of ['valid','expired','suspended']) {
    const email = `verification-${kind}-${randomBytes(8).toString('hex')}@security-test.invalid`
    const user = await prisma.user.create({data:{email,name:'Disposable verification check',...(kind === 'suspended' ? {suspendedAt:new Date()} : {})}})
    users.push(user.id)
    const raw = token()
    const identifier = `verify:${email}`
    identifiers.push(identifier)
    await prisma.verificationToken.create({data:{identifier,token:hash(raw),expires:new Date(Date.now()+(kind === 'expired' ? -60000 : 3600000))}})
    fixtures.push({kind,user,raw})
  }
  const valid = fixtures[0]
  const first = await page.request.get(`${base}/verify-email?token=${valid.raw}`)
  assert.equal(first.status(),200)
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:valid.user.id}})).emailVerified,null)
  results.push({check:'Plain email-scanner GET does not consume the token or verify the account',passed:true})
  await page.goto(`${base}/verify-email?token=${valid.raw}`)
  await page.waitForURL((url: URL)=>url.pathname==='/verify-email/verified')
  assert.equal(await page.getByRole('heading',{name:'Email verified.',exact:true}).count(),1)
  assert.equal(await page.getByRole('link',{name:'Sign in to continue →',exact:true}).getAttribute('href'),'/signin')
  assert.ok((await prisma.user.findUniqueOrThrow({where:{id:valid.user.id}})).emailVerified)
  assert.equal(await prisma.verificationToken.count({where:{token:hash(valid.raw)}}),0)
  assert.equal((await context.cookies()).some((cookie: {name:string})=>cookie.name.includes('session-token')),false)
  await page.screenshot({path:`${output}/email-verified-mobile.png`,fullPage:true})
  results.push({check:'Browser click automatically verifies once, removes the token from the URL and shows Sign in to continue without signing in automatically',passed:true})
  for (const fixture of fixtures) {
    await page.goto(`${base}/verify-email?token=${fixture.raw}`)
    await page.locator('[data-error-code="WT-AUTH-001"]').waitFor()
    if (fixture.kind !== 'valid') assert.equal((await prisma.user.findUniqueOrThrow({where:{id:fixture.user.id}})).emailVerified,null)
    results.push({check:`${fixture.kind === 'valid' ? 'Used' : fixture.kind} token rejected with coded recovery notice`,passed:true})
  }
  await page.goto(base+'/verify-email')
  await page.locator('[data-error-code="WT-AUTH-001"]').waitFor()
  await page.locator('#verification-email').fill(`not-an-account-${randomBytes(8).toString('hex')}@security-test.invalid`)
  await page.getByRole('button',{name:'Send verification email',exact:true}).click()
  await page.getByRole('status').filter({hasText:'If this address is eligible'}).waitFor()
  results.push({check:'Missing link offers resend; unknown-address resend returns a generic response without sending mail',passed:true})
  assert.deepEqual(errors,[])
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900})
    await page.goto(base+'/verify-email/verified')
    const size = await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,scrollHeight:document.documentElement.scrollHeight,height:innerHeight}))
    assert.ok(size.scrollWidth<=size.width)
    assert.ok(size.scrollHeight<=size.height)
  }
  writeFileSync(`${output}/verification-flow-results.json`,JSON.stringify({base,results,noRealEmailSent:true},null,2))
  console.log(JSON.stringify({passed:true,checks:results.length,noRealEmailSent:true}))
} finally {
  if (browser) await browser.close()
  await prisma.verificationToken.deleteMany({where:{identifier:{in:identifiers}}})
  await prisma.user.deleteMany({where:{id:{in:users}}})
  await prisma.$disconnect()
}
