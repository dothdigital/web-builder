import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { prisma } from '@awb/database'

export async function deliverCompletionEmails() {
  const from = process.env.SES_MAILER_FROM
  if (!from) return // Keep the durable outbox pending until the sender is configured.
  const accessKeyId = process.env.SES_MAILER_ACCESS_KEY
  const secretAccessKey = process.env.SES_MAILER_SECRET_KEY
  const client = new SESv2Client({ region: process.env.SES_MAILER_AWS_REGION || 'ca-central-1', ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) })
  try {
    const now = new Date()
    const jobs = await prisma.contentJob.findMany({ where: { status: { in: ['READY', 'APPLIED'] }, emailStatus: 'PENDING', emailTo: { not: null }, emailAttempts: { lt: 5 }, AND: [{ OR: [{ emailNextAttemptAt: null }, { emailNextAttemptAt: { lte: now } }] }, { OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lt: now } }] }] }, take: 10, orderBy: { finishedAt: 'asc' } })
    for (const job of jobs) {
      const lease = new Date(Date.now() + 120000)
      const claimed = await prisma.contentJob.updateMany({ where: { id: job.id, emailStatus: 'PENDING', OR: [{ emailLeaseUntil: null }, { emailLeaseUntil: { lt: now } }] }, data: { emailLeaseUntil: lease, emailAttempts: { increment: 1 } } })
      if (!claimed.count) continue
      try {
        const base = process.env.PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
        const link = new URL(`/projects/${job.projectId}/editor`, base).href
        await client.send(new SendEmailCommand({ FromEmailAddress: from, Destination: { ToAddresses: [job.emailTo!] }, Content: { Simple: { Subject: { Data: 'Your Webtummy content is ready', Charset: 'UTF-8' }, Body: { Text: { Data: `${job.title} is ready.\n\nOpen your editor to review it:\n${link}\n\nYour website has not been published automatically.\n\nWebtummy`, Charset: 'UTF-8' } } } } }), { abortSignal: AbortSignal.timeout(20000) })
        await prisma.contentJob.updateMany({ where: { id: job.id, emailLeaseUntil: lease }, data: { emailStatus: 'SENT', emailLeaseUntil: null } })
      } catch {
        await prisma.contentJob.updateMany({ where: { id: job.id, emailLeaseUntil: lease }, data: { emailStatus: job.emailAttempts + 1 >= 5 ? 'FAILED' : 'PENDING', emailLeaseUntil: null, emailNextAttemptAt: new Date(Date.now() + 60000 * 2 ** job.emailAttempts) } })
      }
    }
  } finally { client.destroy() }
}
