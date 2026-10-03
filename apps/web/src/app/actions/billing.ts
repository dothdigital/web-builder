'use server'
import { WorkspaceRole } from '@awb/database'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { primaryWorkspace, requireUser, requireWorkspace } from '@/lib/tenancy'
import { billingPortal, checkout } from '@/lib/billing/service'
import { stripeReady } from '@/lib/billing/stripe'
export async function openCheckout(_previous: { message: string }, form: FormData) {
  let url: string
  try {
    const user = await requireUser(); const workspace = await primaryWorkspace(user.id)
    if (!workspace) throw new Error('No workspace found.')
    await requireWorkspace(workspace.id, WorkspaceRole.OWNER)
    if (!stripeReady()) throw new Error('Payments are not configured yet. Please contact support.')
    url = await checkout(workspace.id, z.string().min(1).parse(form.get('priceId')), user.email)
  } catch (error) { return { message: error instanceof Error && /^(Payments|This |Choose |Resolve |Your payment|No workspace|You do not)/.test(error.message) ? error.message : 'Unable to open checkout. Please try again or contact support.' } }
  redirect(url)
}
export async function openBillingPortal(_previous: { message: string }, _form: FormData) {
  void _previous; void _form
  let url: string
  try { const user = await requireUser(); const workspace = await primaryWorkspace(user.id); if (!workspace) throw new Error(); await requireWorkspace(workspace.id, WorkspaceRole.OWNER); url = await billingPortal(workspace.id) }
  catch { return { message: 'Unable to open billing. Choose a plan first, or contact support.' } }
  redirect(url)
}
