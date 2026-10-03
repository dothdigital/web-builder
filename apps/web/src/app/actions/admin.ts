'use server'
import { prisma } from '@awb/database'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/tenancy'
import { stripeClient } from '@/lib/billing/stripe'
export type AdminResult = { message: string; ok?: boolean }
export async function savePlan(_previous: AdminResult, form: FormData): Promise<AdminResult> {
  try {
    const actor = await requireAdmin()
    const input = z.object({ id: z.string().min(1), name: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(300), websiteLimit: z.coerce.number().int().min(1).max(100000), active: z.boolean(), features: z.array(z.string().trim().min(1).max(150)).max(12) }).parse({ id: form.get('id'), name: form.get('name'), description: form.get('description'), websiteLimit: form.get('websiteLimit'), active: form.get('active') === 'on', features: String(form.get('features') ?? '').split('\n').filter(line => line.trim()) })
    const { id, ...data } = input
    await prisma.$transaction(async tx => { await tx.billingPlan.update({ where: { id }, data }); await tx.auditEvent.create({ data: { actorId: actor.id, action: 'admin.plan.update', targetType: 'BillingPlan', targetId: id, metadata: data } }) })
    revalidatePath('/admin/plans'); revalidatePath('/billing'); revalidatePath('/pricing')
    return { ok: true, message: 'Plan updated. Existing subscribers use the updated website allowance.' }
  } catch { return { message: 'Unable to update the plan. Check the fields and your admin access.' } }
}
export async function attachPlanPrice(_previous: AdminResult, form: FormData): Promise<AdminResult> {
  try {
    const actor = await requireAdmin()
    const planId = z.string().min(1).parse(form.get('planId'))
    const priceId = z.string().regex(/^price_[a-zA-Z0-9]+$/).parse(form.get('stripePriceId'))
    const price = await stripeClient().prices.retrieve(priceId)
    if (!price.active || !price.recurring || !['month', 'year'].includes(price.recurring.interval) || price.recurring.interval_count !== 1 || price.recurring.usage_type !== 'licensed' || !price.unit_amount || price.billing_scheme !== 'per_unit' || !['cad', 'usd', 'eur', 'gbp', 'aud'].includes(price.currency)) return { message: 'Use an active fixed monthly or annual Stripe price in CAD, USD, EUR, GBP or AUD.' }
    const product = typeof price.product === 'string' ? price.product : price.product.id
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "BillingPlan" WHERE "id" = ${planId} FOR UPDATE`
      const existing = await tx.billingPrice.findUnique({ where: { stripePriceId: price.id } })
      if (existing && existing.planId !== planId) throw new Error('Price already belongs to another plan')
      await tx.billingPrice.updateMany({ where: { planId, interval: price.recurring!.interval }, data: { active: false } })
      await tx.billingPrice.upsert({ where: { stripePriceId: price.id }, create: { planId, stripePriceId: price.id, stripeProductId: product, interval: price.recurring!.interval, amount: price.unit_amount!, currency: price.currency }, update: { active: true } })
      await tx.auditEvent.create({ data: { actorId: actor.id, action: 'admin.plan.price', targetType: 'BillingPlan', targetId: planId, metadata: { stripePriceId: price.id } } })
    })
    revalidatePath('/admin/plans'); revalidatePath('/billing'); revalidatePath('/pricing')
    return { ok: true, message: 'Price verified with Stripe and attached. Existing subscriptions keep their existing price.' }
  } catch { return { message: 'Could not verify this price. Check Stripe configuration, the price ID, and that it is not used by another plan.' } }
}
export async function manageUser(_previous: AdminResult, form: FormData): Promise<AdminResult> {
  try {
    const actor = await requireAdmin()
    const id = z.string().min(1).parse(form.get('id'))
    const action = z.enum(['suspend', 'restore', 'grant-admin', 'remove-admin']).parse(form.get('operation'))
    if (id === actor.id) return { message: 'You cannot suspend or change your own admin access here.' }
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "isPlatformAdmin" = true ORDER BY "id" FOR UPDATE`
      const freshActor = await tx.user.findUniqueOrThrow({ where: { id: actor.id } })
      if (!freshActor.isPlatformAdmin || freshActor.suspendedAt) throw new Error('Admin access changed')
      const target = await tx.user.findUniqueOrThrow({ where: { id } })
      await tx.user.update({ where: { id }, data: action === 'suspend' ? { suspendedAt: new Date(), sessionVersion: { increment: 1 } } : action === 'restore' ? { suspendedAt: null } : { isPlatformAdmin: action === 'grant-admin', sessionVersion: { increment: 1 } } })
      await tx.auditEvent.create({ data: { actorId: actor.id, action: `admin.user.${action}`, targetType: 'User', targetId: target.id } })
    })
    revalidatePath('/admin/users'); return { ok: true, message: 'Account updated.' }
  } catch { return { message: 'Unable to update this account.' } }
}
export async function manageWorkspace(_previous: AdminResult, form: FormData): Promise<AdminResult> {
  try {
    const actor = await requireAdmin(); const id = z.string().min(1).parse(form.get('id'))
    const operation = z.enum(['suspend', 'restore', 'exempt', 'require-plan']).parse(form.get('operation'))
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${id} FOR UPDATE`
      await tx.workspace.update({ where: { id }, data: operation === 'suspend' ? { status: 'SUSPENDED' } : operation === 'restore' ? { status: 'ACTIVE' } : { billingExempt: operation === 'exempt' } })
      await tx.auditEvent.create({ data: { actorId: actor.id, workspaceId: id, action: `admin.workspace.${operation}` } })
    })
    revalidatePath('/admin'); return { ok: true, message: 'Workspace access updated. Stripe billing was not changed.' }
  } catch { return { message: 'Unable to update this workspace.' } }
}

export async function createPlanPrice(previous: AdminResult, form: FormData): Promise<AdminResult> {
  try {
    await requireAdmin()
    const planId = z.string().min(1).parse(form.get('planId'))
    const amount = z.coerce.number().min(0.5).max(100000).parse(form.get('amount'))
    const cents = Math.round(amount * 100)
    if (Math.abs(cents / 100 - amount) > 0.000001) return { message: 'Use no more than two decimal places.' }
    const currency = z.enum(['cad', 'usd', 'eur', 'gbp', 'aud']).parse(form.get('currency'))
    const interval = z.enum(['month', 'year']).parse(form.get('interval'))
    const plan = await prisma.billingPlan.findUniqueOrThrow({ where: { id: planId }, include: { prices: { take: 1 } } })
    const stripe = stripeClient()
    const product = plan.prices[0]?.stripeProductId ?? (await stripe.products.create({ name: `Webtummy ${plan.name}`, description: plan.description, metadata: { planId } }, { idempotencyKey: `plan-product-${planId}` })).id
    const price = await stripe.prices.create({ product, unit_amount: cents, currency, recurring: { interval } }, { idempotencyKey: `plan-price-${planId}-${cents}-${currency}-${interval}` })
    const input = new FormData(); input.set('planId', planId); input.set('stripePriceId', price.id)
    return attachPlanPrice(previous, input)
  } catch { return { message: 'Unable to create this price. Check the amount and Stripe configuration.' } }
}
