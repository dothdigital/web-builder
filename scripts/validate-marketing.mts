import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
config({ path: '.env', quiet: true })
const database = await import('@awb/database')
const { prisma } = database
const policy = await import('@awb/database/marketing')
const { designFromText } = await import('@awb/shared/email-design')
const prefix = `mail-test-${randomUUID()}`
const files = [`.${prefix}-dispatch.mjs`, `.${prefix}-sender.mjs`].map(f => `${process.cwd()}/scripts/${f}`)
const users: string[] = [], workspaces: string[] = [], contacts: string[] = []
let campaignId = '', planId = ''
const testSettings = { id: 'main', automationEnabled: true, deliveryEnabled: true, senderName: 'Validation', mailingAddress: 'Test address — no delivery', dailyLimit: 500, scanCursor: null }
let calls: any[] = [], mode = 'ok'
try {
  const plan = await prisma.billingPlan.create({ data: { slug: prefix, name: prefix, websiteLimit: 1, description: 'Fixture' } }); planId = plan.id
  async function create(label: string, site: boolean, paid = false, optedIn = true) {
    const user = await prisma.user.create({ data: { email: `${prefix}-${label}@validation.invalid`, name: label, emailVerified: new Date(), emailContact: { create: { optedIn, firstLoginAt: new Date(Date.now() - 8 * policy.DAY), consentAt: optedIn ? new Date() : null } }, memberships: { create: { role: 'OWNER', workspace: { create: { name: label, slug: `${prefix}-${label}`, trialEndsAt: new Date(Date.now() - policy.DAY), ...(paid ? { billingPlanId: planId, billingStatus: 'active', billingPeriodEnd: new Date(Date.now() + policy.DAY) } : {}), ...(site ? { projects: { create: { name: 'Test site', slug: 'test', previewHost: `${randomUUID()}.invalid` } } } : {}) } } } } }, include: { emailContact: true, memberships: true } })
    users.push(user.id); contacts.push(user.emailContact!.id); workspaces.push(user.memberships[0]!.workspaceId)
    return prisma.emailContact.findUniqueOrThrow({ where: { userId: user.id }, include: policy.contactInclude })
  }
  const noSite = await create('no-site', false), site = await create('has-site', true), paid = await create('paid', true, true), optedOut = await create('opted-out', false, false, false)
  assert.ok(noSite.createdAt.getTime() > Date.now() - 10000, 'Database timestamps use UTC even on a non-UTC database server')
  assert.equal(policy.matchesAudience(noSite, 'EXPIRED', 'NO_WEBSITE'), true)
  assert.equal(policy.matchesAudience(site, 'UNPAID', 'HAS_WEBSITE'), true)
  assert.equal(policy.matchesAudience(paid, 'UNPAID', 'ANY'), false)
  assert.equal(policy.matchesAudience(paid, 'PAID', 'ANY'), true)
  assert.equal(policy.matchesAudience(optedOut, 'UNPAID', 'ANY'), false)
  const steps = await prisma.emailSequenceStep.findMany({ where: { enabled: true } })
  assert.equal(policy.latestDueStep(steps, noSite)?.step.id, 'day7-no-site')
  assert.equal(policy.latestDueStep(steps, site)?.step.id, 'day7-site')
  assert.equal(policy.latestDueStep(steps, paid), null)
  assert.equal(policy.latestDueStep(steps, { ...noSite, convertedAt: new Date() }), null)
  assert.equal(policy.latestDueStep(steps, noSite, new Date(noSite.firstLoginAt!.getTime() + 15 * policy.DAY))?.occurrence, 1)
  assert.throws(() => policy.validateTemplate('Hi {{secret}}', 'test body'), /Unknown/)
  assert.throws(() => policy.validateTemplate('Hi\nInjected', 'test body'), /one line/)
  const rendered = policy.renderMarketing('For {{name}}', '{{website_name}} {{billing_url}}', site, 'https://example.invalid', 'Mailing address')
  assert.ok(rendered.body.includes('Test site')); assert.ok(rendered.body.includes('https://example.invalid/billing')); assert.ok(rendered.body.includes('Unsubscribe'))
  const campaign = await prisma.emailCampaign.create({ data: { name: prefix, audience: 'UNPAID', websiteCondition: 'ANY', subject: 'Hello {{name}}', body: 'Your saved website is ready to review.', bodyDesign: { ...designFromText('Hi {{name}}, your saved website is ready to review.'), mode: 'html', sourceHtml: '<html><body><h1>Hi {{name}}</h1><p>Your saved website is ready to review.</p></body></html>' }, status: 'QUEUED', queuedAt: new Date() } }); campaignId = campaign.id
  // No real settings are enabled. Scope all dispatch/delivery reads to disposable contacts.
  function wrap(client: any): any {
    return new Proxy(client, { get(target, prop) {
      if (prop === '$transaction') return (callback: any, options: any) => target.$transaction((tx: any) => callback(wrap(tx)), options)
      if (prop === 'emailMarketingSettings') return { findUnique: async () => ({ ...testSettings }), update: async (args: any) => Object.assign(testSettings, args.data) }
      if (['emailContact', 'emailCampaign', 'emailDelivery'].includes(String(prop))) {
        const delegate = target[prop]
        return new Proxy(delegate, { get(d, operation) {
          const method = d[operation]
          if (['findMany', 'findFirst', 'count', 'updateMany'].includes(String(operation))) return (args: any = {}) => method.call(d, { ...args, where: { AND: [args.where ?? {}, prop === 'emailContact' ? { id: { in: contacts } } : prop === 'emailCampaign' ? { id: campaignId } : { contactId: { in: contacts } }] } })
          return typeof method === 'function' ? method.bind(d) : method
        } })
      }
      const value = target[prop]; return typeof value === 'function' ? value.bind(target) : value
    } })
  }
  ;(globalThis as any).__marketingDb = wrap(prisma)
  ;(globalThis as any).__marketingSend = async (command: any) => { calls.push(command.input); if (mode !== 'ok') { const error = new Error('Mock provider result'); error.name = mode; throw error }; return { MessageId: `mock-${calls.length}` } }
  const plugin = { name: 'mock-database-and-ses', setup(b: any) {
    b.onResolve({ filter: /^(\.\/index|@awb\/database)$/ }, () => ({ path: 'db', namespace: 'mock' }))
    b.onResolve({ filter: /^@aws-sdk\/client-sesv2$/ }, () => ({ path: 'ses', namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (args: any) => ({ loader: 'js', contents: args.path === 'db' ? 'export const prisma = globalThis.__marketingDb' : 'export class SESv2Client { async send(c) { return globalThis.__marketingSend(c) }; destroy() {} }; export class SendEmailCommand { constructor(input) { this.input = input } }' }))
  } }
  await build({ entryPoints: ['packages/database/src/marketing.ts'], outfile: files[0], bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [plugin] })
  await build({ entryPoints: ['apps/worker/src/marketing-email.ts'], outfile: files[1], bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [plugin] })
  const { dispatchMarketing } = await import(pathToFileURL(files[0]!).href)
  const { deliverMarketingEmails } = await import(pathToFileURL(files[1]!).href)
  await Promise.all([dispatchMarketing(), dispatchMarketing()])
  assert.equal(await prisma.emailDelivery.count({ where: { contactId: { in: contacts } } }), 4, 'Only matching branches and unsubscribed exclusions, dispatch deduped')
  assert.ok((await prisma.emailContact.findUnique({ where: { id: paid.id } }))?.convertedAt, 'Paid contact permanently leaves nurture')
  await dispatchMarketing()
  assert.equal(await prisma.emailDelivery.count({ where: { contactId: { in: contacts } } }), 4, 'Repeated dispatch does not duplicate recipients')
  // Unsubscribe and payment after queueing must suppress both campaign and nurture.
  await prisma.emailContact.update({ where: { id: noSite.id }, data: { optedIn: false } })
  await prisma.workspace.update({ where: { id: workspaces[1] }, data: { billingPlanId: planId, billingStatus: 'active', billingPeriodEnd: new Date(Date.now() + policy.DAY) } })
  process.env.SES_MAILER_FROM = 'noreply@example.invalid'; process.env.PUBLIC_APP_URL = 'https://example.invalid'
  await deliverMarketingEmails()
  assert.equal(calls.length, 0, 'No send after unsubscribe or payment')
  assert.equal(await prisma.emailDelivery.count({ where: { contactId: { in: contacts }, status: 'SKIPPED' } }), 4)
  // Actual SES call is mocked; exercise successful delivery and one-click headers.
  await prisma.emailDelivery.create({ data: { contactId: optedOut.id, campaignId, dedupeKey: `${prefix}-success` } })
  await prisma.emailContact.update({ where: { id: optedOut.id }, data: { optedIn: true } })
  await Promise.all([deliverMarketingEmails(), deliverMarketingEmails()])
  assert.equal(calls.length, 1, 'Concurrent workers send once')
  assert.ok(calls[0].Content.Simple.Body.Html.Data.includes('<!doctype html>'), 'SES receives HTML and text alternatives')
  assert.ok(calls[0].Content.Simple.Body.Html.Data.includes('opted-out'), 'HTML is personalised before delivery')
  assert.equal(calls[0].Content.Simple.Headers[1].Value, 'List-Unsubscribe=One-Click')
  assert.ok(calls[0].Content.Simple.Body.Text.Data.includes('Mailing') || calls[0].Content.Simple.Body.Text.Data.includes('Test address'))
  assert.equal((await prisma.emailDelivery.findUnique({ where: { dedupeKey: `${prefix}-success` } }))?.status, 'SENT')
  testSettings.dailyLimit = 1
  await prisma.emailDelivery.create({ data: { contactId: optedOut.id, campaignId, dedupeKey: `${prefix}-limited` } })
  await deliverMarketingEmails(); assert.equal(calls.length, 1, 'Global daily budget enforced')
  testSettings.dailyLimit = 500; mode = 'TooManyRequestsException'
  await deliverMarketingEmails()
  assert.equal((await prisma.emailDelivery.findUnique({ where: { dedupeKey: `${prefix}-limited` } }))?.status, 'PENDING', 'SES throttling retried with backoff')
  await prisma.emailDelivery.update({ where: { dedupeKey: `${prefix}-limited` }, data: { nextAttemptAt: new Date(0) } })
  mode = 'TimeoutError'; await deliverMarketingEmails()
  assert.equal((await prisma.emailDelivery.findUnique({ where: { dedupeKey: `${prefix}-limited` } }))?.status, 'UNKNOWN', 'Ambiguous delivery is never automatically duplicated')
  testSettings.deliveryEnabled = false; await deliverMarketingEmails(); assert.equal(calls.length, 3)
  console.log('PASS: branch timing, repeat cadence, audience filters, permanent conversion stop, consent, template validation, paged deduplication, concurrent delivery, unsubscribe/payment recheck, SES headers, global daily cap, retries and ambiguous-send protection. No real email sent; settings stayed paused.')
} finally {
  if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } })
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  if (planId) await prisma.billingPlan.deleteMany({ where: { id: planId } })
  for (const file of files) await unlink(file).catch(() => {})
  await prisma.$disconnect()
}
