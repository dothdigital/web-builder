import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { localUploadRoot } from '@awb/shared'
import { WorkspaceRole, prisma } from '@awb/database'
import { extractLogoColors, getStorage } from '@awb/shared'
import { paletteAlternatives } from '@awb/ai'
import { defaultTokens } from '@awb/component-registry'
import { designTokensSchema } from '@awb/website-model'
import { requireProject, withApiAuthorization } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = withApiAuthorization(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params
  await requireProject(id, WorkspaceRole.EDITOR)
  const brand = await prisma.brandProfile.findUnique({ where: { projectId: id }, include: { logo: true } })
  if (!brand?.logo) return Response.json({ error: 'Upload a logo first.' }, { status: 404 })
  let bytes: Buffer
  try {
    const storage = getStorage()
    if (storage.driver === 'local') {
      const root = path.resolve(localUploadRoot())
      const target = path.resolve(root, brand.logo.storageKey)
      if (!target.startsWith(root + path.sep)) return Response.json({ error: 'Logo unavailable.' }, { status: 404 })
      bytes = await readFile(target)
    } else {
      const response = await fetch(await storage.readUrl(brand.logo.storageKey))
      if (!response.ok) throw new Error('Logo unavailable')
      bytes = Buffer.from(await response.arrayBuffer())
    }
  } catch { return Response.json({ error: 'Could not read your logo. Please try again.' }, { status: 502 }) }
  const colors = await extractLogoColors(bytes)
  const parsed = designTokensSchema.safeParse(brand.tokens)
  return Response.json({ colors, suggestions: paletteAlternatives(parsed.success ? parsed.data : defaultTokens, colors.map(color => color.hex)) }, { headers: { 'Cache-Control': 'private, no-store' } })
})
