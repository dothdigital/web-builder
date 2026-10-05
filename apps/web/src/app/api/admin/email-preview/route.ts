import { sameOriginRequest } from '@/lib/request-origin'
import { requireAdmin } from '@/lib/tenancy'
import { appUrl } from '@/lib/account-security'
import { prisma } from '@awb/database'
import { renderEmailDesign } from '@awb/shared/email-render'
export async function POST(request: Request) {
  await requireAdmin()
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const text = await request.text()
  if (text.length > 500000) return Response.json({ error: 'Email design is too large.' }, { status: 413 })
  try {
    const design = JSON.parse(text)
    const settings = await prisma.emailMarketingSettings.findUnique({ where: { id: 'main' } })
    const base = appUrl()
    const source = new URL(request.url).searchParams.get('source') === '1'
    const values = { name: 'Alex', website_name: 'Your website', trial_end: 'your trial end date', dashboard_url: `${base}/dashboard`, billing_url: `${base}/billing`, unsubscribe_url: `${base}/email-preferences` }
    const html = renderEmailDesign(design, source ? Object.fromEntries(Object.keys(values).map(key => [key, `{{${key}}}`])) : values, base, settings?.mailingAddress || '[Your business mailing address]', `${base}/email-preferences`, !source)
    return Response.json({ html }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: 'Check the email design, links and image addresses.' }, { status: 400 }) }
}
