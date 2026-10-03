import { prisma, type Prisma } from './index'

export const DAY = 86400000
export const contactInclude = {
  user: {
    include: {
      accounts: { select: { provider: true } },
      memberships: {
        where: { role: 'OWNER' as const },
        include: {
          workspace: {
            include: { projects: { select: { name: true }, orderBy: { createdAt: 'asc' as const }, take: 1 } },
          },
        },
      },
    },
  },
} as const
export type MarketingContact = Prisma.EmailContactGetPayload<{ include: typeof contactInclude }>
export type Audience = 'PAID' | 'UNPAID' | 'TRIAL' | 'EXPIRED'
export type WebsiteCondition = 'ANY' | 'HAS_WEBSITE' | 'NO_WEBSITE'
export function contactState(contact: MarketingContact, now = new Date()) {
  const workspaces = contact.user.memberships.map(m => m.workspace).filter(w => w.status === 'ACTIVE')
  const paid = workspaces.some(w => w.billingPlanId && w.billingStatus === 'active' && w.billingPeriodEnd && w.billingPeriodEnd > now)
  const complimentary = workspaces.some(w => w.billingExempt)
  const trial = workspaces.some(w => w.trialEndsAt > now)
  const website = workspaces.flatMap(w => w.projects)[0]
  const trialEnd = workspaces.map(w => w.trialEndsAt).sort((a, b) => b.getTime() - a.getTime())[0]
  const verified = !!contact.user.emailVerified || contact.user.accounts.some(a => ['google', 'microsoft-entra-id'].includes(a.provider))
  return { paid, trial, complimentary, website, trialEnd, eligible: contact.optedIn && verified && !contact.user.suspendedAt && workspaces.length > 0 && !complimentary }
}
export function matchesAudience(contact: MarketingContact, audience: string, condition: string, now = new Date()) {
  const state = contactState(contact, now)
  return state.eligible && (condition === 'ANY' || condition === 'HAS_WEBSITE' && !!state.website || condition === 'NO_WEBSITE' && !state.website)
    && (audience === 'PAID' ? state.paid : audience === 'UNPAID' ? !state.paid : audience === 'TRIAL' ? !state.paid && state.trial : audience === 'EXPIRED' ? !state.paid && !state.trial : false)
}
export function latestDueStep<T extends { id: string; delayDays: number; repeatDays: number; websiteCondition: string }>(steps: T[], contact: MarketingContact, now = new Date()) {
  if (!contact.firstLoginAt || contact.convertedAt || !matchesAudience(contact, 'UNPAID', 'ANY', now)) return null
  const age = Math.floor((now.getTime() - contact.firstLoginAt.getTime()) / DAY)
  return steps.filter(s => s.delayDays <= age && matchesAudience(contact, 'UNPAID', s.websiteCondition, now)).map(step => {
    const occurrence = step.repeatDays ? Math.floor((age - step.delayDays) / step.repeatDays) : 0
    return { step, occurrence, day: step.delayDays + occurrence * step.repeatDays, key: `sequence:${contact.id}:${step.id}:${occurrence}` }
  }).sort((a, b) => b.day - a.day || a.step.id.localeCompare(b.step.id))[0] ?? null
}
export const templateTokens = ['name', 'website_name', 'trial_end', 'dashboard_url', 'billing_url', 'unsubscribe_url']
export function validateTemplate(subject: string, body: string) {
  if (/[\r\n]/.test(subject)) throw new Error('Subject must be one line.')
  for (const match of `${subject}\n${body}`.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) if (!templateTokens.includes(match[1]!)) throw new Error(`Unknown placeholder: ${match[1]}`)
}
export function renderMarketing(subject: string, body: string, contact: MarketingContact, base: string, mailingAddress: string, now = new Date()) {
  const state = contactState(contact, now)
  const unsubscribe = `${base}/email-preferences?token=${encodeURIComponent(contact.unsubscribeToken)}`
  const values: Record<string, string> = { name: contact.user.name || 'there', website_name: state.website?.name || 'your website', trial_end: state.trialEnd?.toLocaleDateString('en-CA', { timeZone: 'UTC' }) || 'your trial end date', dashboard_url: `${base}/dashboard`, billing_url: `${base}/billing`, unsubscribe_url: unsubscribe }
  const render = (value: string) => value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => values[key] ?? '')
  return { values, subject: render(subject).replace(/[\r\n]/g, ' '), body: `${render(body)}\n\nWebtummy\n${mailingAddress}\n\nUnsubscribe from onboarding and promotional emails: ${unsubscribe}`, unsubscribe }
}
export async function countAudience(audience: string, websiteCondition: string) {
  let cursor: string | undefined; let count = 0
  for (;;) {
    const contacts = await prisma.emailContact.findMany({ where: { optedIn: true, ...(cursor ? { id: { gt: cursor } } : {}) }, include: contactInclude, orderBy: { id: 'asc' }, take: 250 })
    for (const contact of contacts) if (matchesAudience(contact, audience, websiteCondition)) count++
    if (contacts.length < 250) return count
    cursor = contacts.at(-1)!.id
  }
}

// Paged, durable dispatch. One cluster-wide scheduler; no in-memory timers per user.
export async function dispatchMarketing() {
  await prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(819231, 1) AS locked`
    if (!lock?.locked) return
    const settings = await tx.emailMarketingSettings.findUnique({ where: { id: 'main' } })
    if (!settings?.deliveryEnabled || !settings.mailingAddress) return
    const now = new Date()
    if (settings.automationEnabled) {
      const steps = await tx.emailSequenceStep.findMany({ where: { enabled: true } })
      const contacts = await tx.emailContact.findMany({ where: { optedIn: true, firstLoginAt: { not: null }, convertedAt: null, ...(settings.scanCursor ? { id: { gt: settings.scanCursor } } : {}) }, include: contactInclude, orderBy: { id: 'asc' }, take: 200 })
      for (const contact of contacts) {
        if (contactState(contact, now).paid) { await tx.emailContact.update({ where: { id: contact.id }, data: { convertedAt: now } }); continue }
        const due = latestDueStep(steps, contact, now)
        if (due) await tx.emailDelivery.createMany({ data: [{ dedupeKey: due.key, contactId: contact.id, stepId: due.step.id }], skipDuplicates: true })
      }
      await tx.emailMarketingSettings.update({ where: { id: 'main' }, data: { scanCursor: contacts.length === 200 ? contacts.at(-1)!.id : null } })
    }
    const campaign = await tx.emailCampaign.findFirst({ where: { status: 'QUEUED', expandedAt: null }, orderBy: { queuedAt: 'asc' } })
    if (campaign) {
      const contacts = await tx.emailContact.findMany({ where: { optedIn: true, createdAt: { lte: campaign.queuedAt! }, ...(campaign.scanCursor ? { id: { gt: campaign.scanCursor } } : {}) }, include: contactInclude, orderBy: { id: 'asc' }, take: 200 })
      await tx.emailDelivery.createMany({ data: contacts.filter(c => matchesAudience(c, campaign.audience, campaign.websiteCondition, now)).map(c => ({ dedupeKey: `campaign:${campaign.id}:${c.id}`, campaignId: campaign.id, contactId: c.id })), skipDuplicates: true })
      await tx.emailCampaign.update({ where: { id: campaign.id }, data: { scanCursor: contacts.at(-1)?.id, ...(contacts.length < 200 ? { expandedAt: now } : {}) } })
    }
    // A crash after a provider accepted a message is ambiguous. Never blindly resend it.
    await tx.emailDelivery.updateMany({ where: { status: 'SENDING', nextAttemptAt: { lt: new Date(now.getTime() - 10 * 60000) } }, data: { status: 'UNKNOWN', detail: 'Worker stopped during delivery. Check SES before sending again.' } })
    const completed = await tx.emailCampaign.findMany({ where: { status: 'QUEUED', expandedAt: { not: null }, deliveries: { none: { status: { in: ['PENDING', 'SENDING'] } } } }, select: { id: true } })
    if (completed.length) await tx.emailCampaign.updateMany({ where: { id: { in: completed.map(c => c.id) } }, data: { status: 'COMPLETE' } })
  }, { timeout: 30000 })
}
