import { renderEmailDesign } from '@awb/shared/email-render'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { prisma } from '@awb/database'
import { contactInclude, contactState, latestDueStep, matchesAudience, renderMarketing, DAY } from '@awb/database/marketing'

// Independent of AI concurrency; one sending lease across every worker process.
export async function deliverMarketingEmails() {
  const from = process.env.SES_MAILER_FROM
  const rawBase = process.env.PUBLIC_APP_URL || process.env.AUTH_URL
  if (!from || !rawBase) return
  const base = new URL(rawBase)
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') return
  const accessKeyId = process.env.SES_MAILER_ACCESS_KEY
  const secretAccessKey = process.env.SES_MAILER_SECRET_KEY
  const client = new SESv2Client({ region: process.env.SES_MAILER_AWS_REGION || 'ca-central-1', maxAttempts: 1, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) })
  try {
    for (let i = 0; i < 5; i++) {
      const handled = await prisma.$transaction(async tx => {
        const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(819231, 2) AS locked`
        if (!lock?.locked) return false
        const settings = await tx.emailMarketingSettings.findUnique({ where: { id: 'main' } })
        if (!settings?.deliveryEnabled || !settings.mailingAddress) return false
        const now = new Date(); const today = new Date(now); today.setUTCHours(0, 0, 0, 0)
        const sent = await tx.emailDelivery.count({ where: { OR: [{ sentAt: { gte: today } }, { status: { in: ['SENDING', 'UNKNOWN'] }, nextAttemptAt: { gte: today } }] } })
        if (sent >= settings.dailyLimit) return false
        const delivery = await tx.emailDelivery.findFirst({ where: { status: 'PENDING', nextAttemptAt: { lte: now }, ...(!settings.automationEnabled ? { campaignId: { not: null } } : {}) }, include: { contact: { include: contactInclude }, campaign: true }, orderBy: { createdAt: 'asc' } })
        if (!delivery) return false
        const contact = delivery.contact
        let subject = ''; let body = ''; let bodyDesign: unknown = null; let eligible = false
        if (delivery.campaign) {
          const campaign = delivery.campaign
          eligible = campaign.status === 'QUEUED' && matchesAudience(contact, campaign.audience, campaign.websiteCondition, now)
          subject = campaign.subject; body = campaign.body; bodyDesign = campaign.bodyDesign
        } else {
          const steps = await tx.emailSequenceStep.findMany({ where: { enabled: true } })
          const due = latestDueStep(steps, contact, now)
          eligible = settings.automationEnabled && !!due && due.key === delivery.dedupeKey
          subject = due?.step.subject ?? ''; body = due?.step.body ?? ''; bodyDesign = due?.step.bodyDesign
          if (contactState(contact, now).paid && !contact.convertedAt) await prisma.emailContact.update({ where: { id: contact.id }, data: { convertedAt: now } })
          // At most one automatic reminder per 24 hours, including after branch changes.
          const recent = await tx.emailDelivery.findFirst({ where: { contactId: contact.id, sentAt: { gt: new Date(now.getTime() - DAY) } }, orderBy: { sentAt: 'desc' } })
          if (eligible && recent?.sentAt) {
            await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(recent.sentAt.getTime() + DAY) } })
            return true
          }
          if (!settings.automationEnabled) return false // Pause, retain pending reminders.
        }
        if (!eligible) {
          await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'SKIPPED', detail: 'Recipient no longer matches the audience, consent or sequence.' } })
          return true
        }
        const message = renderMarketing(subject, body, contact, base.origin, settings.mailingAddress, now)
        const html = bodyDesign ? renderEmailDesign(bodyDesign, message.values, base.origin, settings.mailingAddress, message.unsubscribe) : undefined
        // Commit this state outside the lock transaction before the external side effect.
        // If the process dies, dispatch marks it UNKNOWN instead of duplicating the email.
        await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: now } })
        try {
          await new Promise(resolve => setTimeout(resolve, 1100))
          const result = await client.send(new SendEmailCommand({ FromEmailAddress: `${settings.senderName} <${from}>`, Destination: { ToAddresses: [contact.user.email] }, ...(process.env.SES_MARKETING_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_MARKETING_CONFIGURATION_SET } : {}), Content: { Simple: { Subject: { Data: message.subject, Charset: 'UTF-8' }, Body: { Text: { Data: message.body, Charset: 'UTF-8' }, ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}) }, Headers: [{ Name: 'List-Unsubscribe', Value: `<${base.origin}/api/email-unsubscribe?token=${encodeURIComponent(contact.unsubscribeToken)}>` }, { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }] } } }), { abortSignal: AbortSignal.timeout(15000) })
          await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: new Date(), providerMessageId: result.MessageId, detail: null } })
        } catch (error) {
          const name = error instanceof Error ? error.name : 'UnknownError'
          const retry = ['TooManyRequestsException', 'ThrottlingException', 'LimitExceededException'].includes(name)
          const rejected = ['MessageRejected', 'MessageRejectedException', 'BadRequestException', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException', 'AccessDeniedException', 'NotFoundException'].includes(name)
          await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: retry && delivery.attempts < 4 ? 'PENDING' : rejected || retry ? 'FAILED' : 'UNKNOWN', nextAttemptAt: new Date(Date.now() + 60000 * 2 ** delivery.attempts), detail: retry ? 'SES rate limit; retry scheduled (up to five attempts).' : rejected ? 'SES rejected delivery. Check sender verification, permissions and account status.' : 'Delivery outcome uncertain. Check SES before sending again.' } })
        }
        return true
      }, { timeout: 35000, maxWait: 5000 })
      if (!handled) break
    }
  } finally { client.destroy() }
}
