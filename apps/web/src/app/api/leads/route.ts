import { hostingAccess } from '@/lib/billing/access'
import { decryptRecaptchaSecret, verifyRecaptcha } from '@/lib/recaptcha'
import { rateLimit } from '@/lib/account-security'
import { readBoundedBody, RequestBodyTooLarge } from '@/lib/request-body'
import { LeadStatus, prisma } from '@awb/database'

export const runtime = 'nodejs'

/// Public endpoint used by rendered contact forms. It stores the lead against
/// the project resolved from the referring preview/site path.
export async function POST(request: Request) {
  let form: FormData
  try {
    const bytes = await readBoundedBody(request, 32768)
    form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData()
  } catch (error) { return Response.json({ error: 'Invalid or oversized form' }, { status: error instanceof RequestBodyTooLarge ? 413 : 400 }) }
  const projectId = String(form.get('projectId') ?? '')

  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 })
  }

  if (projectId.length > 100 || [...form.entries()].length > 30 || [...form.entries()].some(([key, value]) => key.length > 100 || typeof value !== 'string' || value.length > 5000)) return Response.json({ error: 'Invalid form' }, { status: 400 })
  try {
    await rateLimit(`lead-ip:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'}`, 20, 1)
    await rateLimit(`lead-project:${projectId}`, 300, 5)
  } catch { return Response.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 }) }

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } })

  if (!project) {
    return Response.json({ error: 'Unknown project' }, { status: 404 })
  }

  if (!hostingAccess(project.workspace)) return Response.json({ error: 'This website is temporarily unavailable.' }, { status: 503 })
  const integration = await prisma.integration.findUnique({ where: { projectId } })
  if (integration?.recaptchaEnabled) {
    const token = String(form.get('g-recaptcha-response') ?? '')
    const domains = await prisma.domain.findMany({ where: { projectId, verifiedAt: { not: null } }, select: { hostname: true } })
    const hosting = await prisma.hostingSite.findUnique({ where: { projectId }, select: { distributionHost: true, publicHost: true, previewHost: true } })
    const hostnames = [project.previewHost, ...[hosting?.distributionHost, hosting?.publicHost, hosting?.previewHost].filter((host): host is string => !!host), ...domains.map((domain) => domain.hostname)]
    const requestHost = new URL(request.url).hostname
    // Local preview is allowed only when this server is itself local.
    if (['localhost', '127.0.0.1'].includes(requestHost)) hostnames.push(requestHost)
    let verified = false
    try { verified = !!integration.recaptchaSecret && await verifyRecaptcha(decryptRecaptchaSecret(integration.recaptchaSecret), token, hostnames.map((host) => host.toLowerCase())) } catch { verified = false }
    if (!verified) return Response.json({ error: 'Please complete reCAPTCHA and try again.' }, { status: 400 })
  }

  const payload = Object.fromEntries(
    [...form.entries()].filter(([key]) => key !== 'projectId' && key !== 'g-recaptcha-response').map(([key, value]) => [key, String(value)]),
  )

  await prisma.lead.create({
    data: {
      projectId,
      status: LeadStatus.NEW,
      payload,
      pagePath: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    },
  })

  return Response.json({ ok: true })
}
