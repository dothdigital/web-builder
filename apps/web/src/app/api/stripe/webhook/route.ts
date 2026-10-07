import { deliverTransactionalEmails } from '@/lib/transactional-email'
import { after, NextResponse } from 'next/server'
import { stripeClient } from '@/lib/billing/stripe'
import { processBillingEvent } from '@/lib/billing/service'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  let event
  try { event = stripeClient().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET) }
  catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) }
  try { await processBillingEvent(event); after(() => deliverTransactionalEmails().catch(() => console.error('Payment email delivery delayed; queued for retry.'))); return NextResponse.json({ received: true }) }
  catch { console.error('Billing webhook processing failed', { eventId: event.id, type: event.type }); return NextResponse.json({ error: 'Processing failed; retry required' }, { status: 500 }) }
}
