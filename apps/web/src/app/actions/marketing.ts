'use server'
import { z } from 'zod'
import { cleanEmailDesign, emailDesignText } from '@awb/shared/email-render'
import { prisma } from '@awb/database'
import { validateTemplate } from '@awb/database/marketing'
import { requireAdmin, requireUser } from '@/lib/tenancy'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const condition = z.enum(['ANY', 'HAS_WEBSITE', 'NO_WEBSITE'])
const content = z.object({ name: z.string().trim().min(2).max(100), subject: z.string().trim().min(2).max(200), body: z.string().trim().min(10).max(150000), websiteCondition: condition })
const fail = (error: unknown) => ({ message: error instanceof z.ZodError ? error.issues[0]?.message ?? 'Check your input.' : error instanceof Error && /^(Email HTML|Email design|Use a valid|Email blocks|Unknown placeholder|Subject must|Add your|Email delivery|Only draft|Campaign|Review)/.test(error.message) ? error.message : 'Unable to save. Please try again.' })
function designData(form: FormData) {
  const raw = form.get('bodyDesign')
  if (typeof raw !== 'string' || !raw) return {}
  if (raw.length > 500000) throw new Error('Email design is too large.')
  const bodyDesign = cleanEmailDesign(JSON.parse(raw))
  const body = emailDesignText(bodyDesign)
  validateTemplate('', bodyDesign.mode === 'html' ? bodyDesign.sourceHtml : JSON.stringify({ ...bodyDesign, sourceHtml: '' }))
  return { bodyDesign, body }
}
function refresh() { revalidatePath('/admin/emails'); revalidatePath('/admin/emails/campaigns', 'layout') }
export async function saveEmailSettings(_state: { message: string }, form: FormData) {
  const actor = await requireAdmin()
  try {
    const data = z.object({ senderName: z.string().trim().min(2).max(80).regex(/^[^<>\r\n"]+$/), mailingAddress: z.string().trim().max(500), dailyLimit: z.coerce.number().int().min(1).max(100000) }).parse(Object.fromEntries(form))
    const deliveryEnabled = form.get('deliveryEnabled') === 'on'; const automationEnabled = form.get('automationEnabled') === 'on'
    if (deliveryEnabled && data.mailingAddress.length < 10) throw new Error('Add your business mailing address before enabling delivery.')
    if (deliveryEnabled && !(process.env.SES_MAILER_FROM && (process.env.PUBLIC_APP_URL || process.env.AUTH_URL))) throw new Error('Email delivery needs an SES sender and app URL configured on the server.')
    await prisma.$transaction([prisma.emailMarketingSettings.upsert({ where: { id: 'main' }, create: { ...data, deliveryEnabled, automationEnabled }, update: { ...data, deliveryEnabled, automationEnabled } }), prisma.auditEvent.create({ data: { actorId: actor.id, action: 'admin.email.settings', targetType: 'EmailMarketingSettings', targetId: 'main', metadata: { deliveryEnabled, automationEnabled } } })])
    refresh(); return { ok: true, message: 'Email settings saved.' }
  } catch (error) { return fail(error) }
}
export async function saveEmailStep(_state: { message: string }, form: FormData) {
  const actor = await requireAdmin()
  try {
    const data = content.extend({ delayDays: z.coerce.number().int().min(0).max(365), repeatDays: z.coerce.number().int().refine(n => n === 0 || n >= 7 && n <= 365, 'Repeat every 7–365 days, or use 0 for once.') }).parse(Object.fromEntries(form))
    validateTemplate(data.subject, data.body)
    const id = z.string().max(100).parse(form.get('id') ?? '')
    const visual = designData(form)
    const saved = id ? await prisma.emailSequenceStep.update({ where: { id }, data: { ...data, ...visual, enabled: form.get('enabled') === 'on' } }) : await prisma.emailSequenceStep.create({ data: { ...data, ...visual, enabled: form.get('enabled') === 'on' } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'admin.email.sequence.edit', targetType: 'EmailSequenceStep', targetId: saved.id } })
    refresh(); return { ok: true, message: 'Sequence step saved. Future unsent emails will use these changes.' }
  } catch (error) { return fail(error) }
}
export async function saveEmailCampaign(_state: { message: string }, form: FormData) {
  const actor = await requireAdmin(); let id = ''
  try {
    const parsed = content.extend({ audience: z.enum(['PAID', 'UNPAID', 'TRIAL', 'EXPIRED']) }).parse(Object.fromEntries(form)); const data = { ...parsed, ...designData(form) }; validateTemplate(data.subject, data.body)
    id = z.string().max(100).parse(form.get('id') ?? '')
    if (id) {
      const result = await prisma.emailCampaign.updateMany({ where: { id, status: 'DRAFT' }, data })
      if (!result.count) throw new Error('Only draft campaigns can be edited. Create a new campaign for a different message.')
    } else id = (await prisma.emailCampaign.create({ data })).id
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'admin.email.campaign.edit', targetType: 'EmailCampaign', targetId: id } })
    refresh()
  } catch (error) { return fail(error) }
  redirect(`/admin/emails/campaigns/${id}`)
}
export async function queueEmailCampaign(_state: { message: string }, form: FormData) {
  const actor = await requireAdmin()
  try {
    const id = z.string().min(1).max(100).parse(form.get('id'))
    if (form.get('confirm') !== 'on') throw new Error('Review the audience and message, then confirm to queue this campaign.')
    const version = z.string().datetime().parse(form.get('version'))
    await prisma.$transaction(async tx => {
      const settings = await tx.emailMarketingSettings.findUnique({ where: { id: 'main' } })
      if (!settings?.deliveryEnabled || !settings.mailingAddress) throw new Error('Email delivery is paused. Enable it in Email settings first.')
      const updated = await tx.emailCampaign.updateMany({ where: { id, status: 'DRAFT', updatedAt: new Date(version) }, data: { status: 'QUEUED', queuedAt: new Date() } })
      if (!updated.count) throw new Error('Campaign changed or was already queued. Refresh and review it again.')
      await tx.auditEvent.create({ data: { actorId: actor.id, action: 'admin.email.campaign.queue', targetType: 'EmailCampaign', targetId: id } })
    })
    refresh(); return { ok: true, message: 'Queued. The worker will deliver this campaign in the background.' }
  } catch (error) { return fail(error) }
}
export async function cancelEmailCampaign(_state: { message: string }, form: FormData) {
  const actor = await requireAdmin()
  try {
    const id = z.string().min(1).max(100).parse(form.get('id'))
    await prisma.$transaction(async tx => {
      await tx.emailCampaign.updateMany({ where: { id, status: { in: ['DRAFT', 'QUEUED'] } }, data: { status: 'CANCELLED' } })
      await tx.emailDelivery.updateMany({ where: { campaignId: id, status: 'PENDING' }, data: { status: 'SKIPPED', detail: 'Campaign cancelled.' } })
      await tx.auditEvent.create({ data: { actorId: actor.id, action: 'admin.email.campaign.cancel', targetType: 'EmailCampaign', targetId: id } })
    })
    refresh(); return { ok: true, message: 'Campaign cancelled. An email already being sent may still arrive.' }
  } catch (error) { return fail(error) }
}
export async function saveMarketingPreference(_state: { message: string }, form: FormData) {
  const user = await requireUser(); const optedIn = form.get('optedIn') === 'on'
  await prisma.emailContact.upsert({ where: { userId: user.id }, create: { userId: user.id, optedIn, consentAt: optedIn ? new Date() : null, firstLoginAt: new Date() }, update: { optedIn, ...(optedIn ? { consentAt: new Date() } : {}) } })
  revalidatePath('/account'); return { ok: true, message: optedIn ? 'You will receive tips and offers.' : 'You are unsubscribed from tips and offers. Account and security emails continue.' }
}
export async function unsubscribeMarketing(_state: { message: string }, form: FormData) {
  const token = z.string().uuid().safeParse(form.get('token'))
  if (token.success) await prisma.emailContact.updateMany({ where: { unsubscribeToken: token.data }, data: { optedIn: false } })
  return { ok: true, message: 'You are unsubscribed from Webtummy onboarding and promotional emails. Account and security emails are unaffected.' }
}
