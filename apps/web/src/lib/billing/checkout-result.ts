import type Stripe from 'stripe'

// A success query parameter is not proof of payment. Match Stripe's stored
// checkout to the authenticated workspace before accepting its subscription.
export function confirmedCheckoutSubscription(session: Stripe.Checkout.Session, workspace: { id: string; stripeCustomerId: string | null }) {
  const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (session.mode !== 'subscription' || session.status !== 'complete' ||
    !['paid', 'no_payment_required'].includes(session.payment_status) ||
    !workspace.stripeCustomerId || customer !== workspace.stripeCustomerId ||
    session.client_reference_id !== workspace.id || session.metadata?.workspaceId !== workspace.id) return null
  return subscription ?? null
}
