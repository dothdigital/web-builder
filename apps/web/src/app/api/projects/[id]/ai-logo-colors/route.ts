import { z } from 'zod'
import { WorkspaceRole, prisma } from '@awb/database'
import { createAiProvider } from '@awb/ai'
import { requireProject, withApiAuthorization } from '@/lib/tenancy'
import { sameOriginRequest } from '@/lib/request-origin'
import { rateLimit } from '@/lib/account-security'
import { readBoundedBody } from '@/lib/request-body'
import { chooseAiBrandPalette } from '@/lib/ai-brand-palette'

export const runtime = 'nodejs'
const inputSchema = z.object({ logoColors: z.array(z.string().regex(/^#[\da-f]{6}$/i)).max(10) })
export const POST = withApiAuthorization(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const { id } = await context.params
  const { user, project } = await requireProject(id, WorkspaceRole.EDITOR)
  let input: z.infer<typeof inputSchema>
  try { input = inputSchema.parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 4096)))) }
  catch { return Response.json({ error: 'Invalid logo colours.' }, { status: 400 }) }
  try { await rateLimit(`ai-logo-colours:${user.id}`, 6, 15) }
  catch { return Response.json({ error: 'Please wait before asking AI to choose again.' }, { status: 429 }) }
  const business = await prisma.businessProfile.findUnique({ where: { projectId: id } })
  try {
    const result = await chooseAiBrandPalette(createAiProvider(), {
      businessName: business?.displayName ?? project.name, description: business?.description ?? '', industry: business?.industry ?? undefined,
      services: [], goals: business?.primaryConversion ? [business.primaryConversion] : [], tonePreferences: business?.tone ? [business.tone] : [],
      answers: {}, hasLogo: true, logoColors: input.logoColors, uploadedImageUrls: [], testimonials: [],
    })
    await prisma.usageRecord.create({ data: { workspaceId: project.workspaceId, projectId: id, kind: 'AI_LOGO_PALETTE', costCents: Math.round(result.usage.costCents), metadata: { model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens } } })
    return Response.json({ suggestion: result.suggestion }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return Response.json({ error: 'AI could not choose colours right now. Please try again or choose a suggested palette.' }, { status: 502 }) }
})
