import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
export async function sendAccountEmail(to: string, subject: string, message: string, html?: string) {
  const from = html ? (process.env.ACCOUNT_EMAIL_FROM || process.env.SES_MAILER_FROM) : process.env.SES_MAILER_FROM
  if (!from) throw new Error('Account email delivery is not configured. Please contact support.')
  const accessKeyId = process.env.SES_MAILER_ACCESS_KEY
  const secretAccessKey = process.env.SES_MAILER_SECRET_KEY
  const client = new SESv2Client({ region: process.env.SES_MAILER_AWS_REGION || 'ca-central-1', ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) })
  try {
    await client.send(new SendEmailCommand({ FromEmailAddress: from, Destination: { ToAddresses: [to] }, Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: html ? message : `${message}\n\nWebtummy`, Charset: 'UTF-8' }, ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}) } } } }), { abortSignal:AbortSignal.timeout(15000) })
  } catch { throw new Error('We could not send the email. Please try again later or contact support.') }
  finally { client.destroy() }
}
