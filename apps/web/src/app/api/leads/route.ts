import { decryptRecaptchaSecret, verifyRecaptcha } from '@/lib/recaptcha'
import { LeadStatus, prisma } from '@awb/database'

export const runtime = 'nodejs'

/// Public endpoint used by rendered contact forms. It stores the lead against
/// the project resolved from the referring preview/site path.
export async function POST(request: Request) {
  const form = await request.formData()
  const projectId = String(form.get('projectId') ?? '')

  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })

  if (!project) {
    return Response.json({ error: 'Unknown project' }, { status: 404 })
  }

  const integration = await prisma.integration.findUnique({ where: { projectId } })
  if (integration?.recaptchaEnabled) {
    const token = String(form.get('g-recaptcha-response') ?? '')
    const domains = await prisma.domain.findMany({ where: { projectId, verifiedAt: { not: null } }, select: { hostname: true } })
    const hosting = await prisma.hostingSite.findUnique({ where: { projectId }, select: { distributionHost: true } })
    const hostnames = [project.previewHost, ...(hosting?.distributionHost ? [hosting.distributionHost] : []), ...domains.map((domain) => domain.hostname)]
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
