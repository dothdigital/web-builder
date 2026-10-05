import { AuthorizationError } from '@/lib/tenancy'
import { requireBillingAccess, invoiceCursor } from '@/lib/billing/history'
import { stripeClient } from '@/lib/billing/stripe'
import { SUPPORT_EMAIL } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId') ?? ''
    const { workspace } = await requireBillingAccess(workspaceId)
    const id = invoiceCursor((await params).invoiceId)
    if (!id || !workspace.stripeCustomerId) throw new AuthorizationError('Invoice unavailable', 404)
    const invoice = await stripeClient().invoices.retrieve(id)
    const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (customer !== workspace.stripeCustomerId) throw new AuthorizationError('Invoice access denied')
    if (!invoice.invoice_pdf) throw new AuthorizationError('Invoice PDF is not available yet', 404)
    const url = new URL(invoice.invoice_pdf)
    if (url.protocol !== 'https:' || !['stripe.com', 'stripeusercontent.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Invalid invoice URL')
    return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch (error) {
    return Response.json({ error: error instanceof AuthorizationError ? error.message : 'Unable to download this invoice. Please try again.', code: 'WT-BILLING-002', supportEmail: SUPPORT_EMAIL }, { status: error instanceof AuthorizationError ? error.status : 502, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
