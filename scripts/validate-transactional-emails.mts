import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import type Stripe from 'stripe'
import type { Prisma } from '@awb/database'
config({ path: '.env', quiet: true })
const { prisma } = await import('@awb/database')
const { queueWelcomeEmail, queuePaymentEmail, deliverTransactionalEmails } = await import('../apps/web/src/lib/transactional-email')
const { welcomeEmail, paymentEmail } = await import('../apps/web/src/lib/transactional-email-template')
const prefix = `transactional-test-${randomUUID()}`
const user = { id: prefix, email: `${prefix}@validation.invalid`, name: '<Test & User>' }
const workspace = { id: prefix, name: '<Test workspace>', stripeCustomerId: 'cus_validation' }
const invoice = { id: prefix, customer: workspace.stripeCustomerId, status: 'paid', amount_paid: 0, currency: 'usd', number: 'TEST-001', status_transitions: { paid_at: 1791240000 }, hosted_invoice_url: 'https://invoice.stripe.com/test?a=1&b=2', invoice_pdf: 'https://pay.stripe.com/test.pdf' } as Stripe.Invoice
const tx = { transactionalEmail: prisma.transactionalEmail, workspaceMember: { findMany: async () => [{ user }] } } as unknown as Prisma.TransactionClient
const send = async () => {}
try {
  const welcome = welcomeEmail(user.name, 'https://webtummy.com')
  assert.ok(welcome.html.includes('&lt;Test &amp; User&gt;'))
  const free = paymentEmail(invoice, workspace.name, 'https://webtummy.com')
  assert.match(free.subject, /subscription is confirmed/)
  assert.match(free.body, /Amount paid: \$0.00/)
  assert.ok(!free.body.includes('We received your payment'))
  assert.ok(free.html.includes('a=1&amp;b=2'))
  assert.match(paymentEmail({ ...invoice, amount_paid: 2900 }, workspace.name, 'https://webtummy.com').body, /payment of \$29.00/)
  await assert.rejects(prisma.$transaction(async transaction => {
    await queueWelcomeEmail(transaction, user)
    throw new Error('rollback')
  }), /rollback/)
  assert.equal(await prisma.transactionalEmail.count({ where: { dedupeKey: `welcome:${user.id}` } }), 0, 'A failed verification transaction cannot queue a welcome')
  const queued = await queueWelcomeEmail(tx, user)
  assert.equal((await queueWelcomeEmail(tx, user)).id, queued.id, 'Verification retries deduplicate welcome emails')
  await queuePaymentEmail(tx, workspace, { ...invoice, status: 'open' })
  await queuePaymentEmail(tx, workspace, { ...invoice, customer: 'cus_other' })
  assert.equal(await prisma.transactionalEmail.count({ where: { kind: 'PAYMENT_RECEIPT', dedupeKey: { contains: prefix } } }), 0)
  await queuePaymentEmail(tx, workspace, invoice)
  await queuePaymentEmail(tx, workspace, invoice)
  assert.equal(await prisma.transactionalEmail.count({ where: { kind: 'PAYMENT_RECEIPT', dedupeKey: { contains: prefix } } }), 1, 'A zero-dollar paid invoice sends one confirmation')
  let sends = 0
  await Promise.all([deliverTransactionalEmails({ id: queued.id, send: async () => { sends++; await new Promise(resolve => setTimeout(resolve, 50)) } }), deliverTransactionalEmails({ id: queued.id, send: async () => { sends++ } })])
  assert.equal(sends, 1, 'Concurrent delivery claims cannot send twice')
  await deliverTransactionalEmails({ id: queued.id, send: async () => { sends++ } })
  assert.equal(sends, 1, 'Sent messages are not redelivered')
  const receipt = await prisma.transactionalEmail.findUniqueOrThrow({ where: { dedupeKey: `receipt:${invoice.id}:${user.id}` } })
  await deliverTransactionalEmails({ id: receipt.id, send: async () => { throw Object.assign(new Error('rate limited'), { name: 'TooManyRequestsException' }) } })
  let result = await prisma.transactionalEmail.findUniqueOrThrow({ where: { id: receipt.id } })
  assert.equal(result.status, 'PENDING')
  assert.ok(result.nextAttemptAt > new Date())
  await prisma.transactionalEmail.update({ where: { id: receipt.id }, data: { nextAttemptAt: new Date(0) } })
  await deliverTransactionalEmails({ id: receipt.id, send: async () => { throw new Error('timeout') } })
  result = await prisma.transactionalEmail.findUniqueOrThrow({ where: { id: receipt.id } })
  assert.equal(result.status, 'UNKNOWN', 'An uncertain send is not blindly retried')
  await deliverTransactionalEmails({ id: receipt.id, send: async () => { sends++ } })
  assert.equal(sends, 1)
  await prisma.transactionalEmail.update({ where: { id: receipt.id }, data: { status: 'SENDING', nextAttemptAt: new Date(0) } })
  await deliverTransactionalEmails({ id: receipt.id, send })
  assert.equal((await prisma.transactionalEmail.findUniqueOrThrow({ where: { id: receipt.id } })).status, 'UNKNOWN')
  console.log('PASS: welcome transaction rollback, invoice ownership/status, zero-dollar confirmation, duplicate protection, concurrent delivery, throttling and uncertain-send handling')
} finally {
  await prisma.transactionalEmail.deleteMany({ where: { dedupeKey: { contains: prefix } } })
  await prisma.$disconnect()
}
