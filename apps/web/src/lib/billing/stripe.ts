import Stripe from 'stripe'
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe payments are not configured yet.')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 12000, maxNetworkRetries: 1 })
}
export const stripeReady = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
