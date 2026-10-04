import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export type ContactMessage = { name: string; email: string; subject: string; message: string }

export function contactEmailConfigured() {
  return !!(process.env.CONTACT_TO_EMAIL && (process.env.CONTACT_FROM_EMAIL || process.env.SES_MAILER_FROM))
}

export async function sendContactEmail(details: ContactMessage) {
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.CONTACT_FROM_EMAIL || process.env.SES_MAILER_FROM
  if (!to || !from) throw new Error('ContactEmailNotConfigured')
  const accessKeyId = process.env.CONTACT_SES_ACCESS_KEY || process.env.SES_MAILER_ACCESS_KEY
  const secretAccessKey = process.env.CONTACT_SES_SECRET_KEY || process.env.SES_MAILER_SECRET_KEY
  const client = new SESv2Client({
    region: process.env.CONTACT_SES_REGION || process.env.SES_MAILER_AWS_REGION || 'ca-central-1',
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  })
  try {
    await client.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [details.email],
      Content: { Simple: {
        Subject: { Data: `Webtummy enquiry: ${details.subject}`, Charset: 'UTF-8' },
        Body: { Text: { Data: `A new message from the Webtummy contact form.\n\nName: ${details.name}\nEmail: ${details.email}\nSubject: ${details.subject}\n\n${details.message}\n\nSent from https://webtummy.com/contact`, Charset: 'UTF-8' } },
      } },
    }), { abortSignal: AbortSignal.timeout(15000) })
  } finally { client.destroy() }
}
