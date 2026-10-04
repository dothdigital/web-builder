import { z } from 'zod'
import { appUrl, rateLimit } from '@/lib/account-security'
import { contactEmailConfigured, sendContactEmail } from '@/lib/contact-email'
import { verifyRecaptcha } from '@/lib/recaptcha'

export const runtime = 'nodejs'

const messageSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(100).regex(/^[^\r\n]+$/),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  subject: z.string().trim().min(3, 'Please add a subject.').max(150).regex(/^[^\r\n]+$/),
  message: z.string().trim().min(10, 'Please include a little more detail in your message.').max(5000, 'Keep your message under 5,000 characters.'),
  website: z.string().max(200).default(''),
  captchaToken: z.string().max(5000).default(''),
})

const success = () => Response.json({ ok: true, message: 'Thanks for reaching out. Your message has been sent to our team.' }, { headers: { 'Cache-Control': 'no-store' } })
const failure = (message: string, status: number) => Response.json({ ok: false, message }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(appUrl()).origin) return failure('Please submit your message from the Webtummy contact page.', 403)
  if (!request.headers.get('content-type')?.startsWith('application/json')) return failure('Invalid form submission.', 415)
  if (Number(request.headers.get('content-length') || 0) > 16384) return failure('Your message is too large.', 413)

  let input: unknown
  try {
    const reader = request.body?.getReader()
    if (!reader) return failure('Please complete the contact form.', 400)
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 16384) { await reader.cancel(); return failure('Your message is too large.', 413) }
      chunks.push(chunk.value)
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return failure('Please complete the contact form and try again.', 400) }

  const parsed = messageSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message || 'Please check your details.', 400)
  const details = parsed.data
  // Silently discard submissions from the field hidden from genuine visitors.
  if (details.website) return success()

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await rateLimit(`contact-ip:${ip}`, 5)
    await rateLimit(`contact-email:${details.email.toLowerCase()}`, 3)
  } catch {
    return failure('We cannot accept another message right now. Please wait a little and try again.', 429)
  }

  const siteKey = process.env.CONTACT_RECAPTCHA_SITE_KEY
  const secret = process.env.CONTACT_RECAPTCHA_SECRET_KEY
  if (siteKey || secret) {
    if (!siteKey || !secret) return failure('The contact form is temporarily unavailable. Please try again later.', 503)
    const captchaType = process.env.CONTACT_RECAPTCHA_TYPE || 'v2'
    if (!['v2', 'v3'].includes(captchaType)) return failure('The contact form is temporarily unavailable. Please try again later.', 503)
    const verified = await verifyRecaptcha(secret, details.captchaToken, [new URL(appUrl()).hostname], captchaType === 'v3' ? { action: 'contact', minimumScore: 0.5 } : undefined)
    if (!verified) return failure('Please complete the security check and try again.', 400)
  }
  if (!contactEmailConfigured()) return failure('The contact form is being set up. Please check back soon.', 503)

  try { await sendContactEmail(details); return success() }
  catch (error) {
    console.error('[contact] Email submission failed:', error instanceof Error ? error.name : 'UnknownError')
    return failure('We could not send your message right now. Your message has not been submitted. Please try again later.', 503)
  }
}
