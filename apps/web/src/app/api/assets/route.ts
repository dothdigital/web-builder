import { AssetKind, AssetSource, WorkspaceRole, prisma } from '@awb/database'
import { assetKey, extractLogoColors, getStorage } from '@awb/shared'
import { paletteAlternatives } from '@awb/ai'
import { defaultTokens } from '@awb/component-registry'
import { requireProject } from '@/lib/tenancy'

export const runtime = 'nodejs'

/// Uploads an image or logo for a project. When the upload is a logo we also
/// return a palette derived from it plus alternatives, so onboarding can offer
/// colours instead of asking the user to invent them.
export async function POST(request: Request) {
  const form = await request.formData()
  const projectId = String(form.get('projectId') ?? '')
  const kind = String(form.get('kind') ?? 'IMAGE') === 'LOGO' ? AssetKind.LOGO : AssetKind.IMAGE
  const file = form.get('file')

  if (!projectId || !(file instanceof File)) {
    return Response.json({ error: 'projectId and file are required' }, { status: 400 })
  }

  const { project } = await requireProject(projectId, WorkspaceRole.EDITOR)
  const bytes = Buffer.from(await file.arrayBuffer())
  const storage = getStorage()
  const stored = await storage.put(assetKey(project.workspaceId, projectId, file.name), bytes, file.type || 'image/png')

  const asset = await prisma.asset.create({
    data: {
      workspaceId: project.workspaceId,
      projectId,
      kind,
      source: AssetSource.UPLOAD,
      storageKey: stored.key,
      url: stored.url,
      mimeType: stored.contentType,
      bytes: stored.bytes,
      altText: String(form.get('altText') ?? ''),
    },
  })

  if (kind !== AssetKind.LOGO) {
    return Response.json({ asset })
  }

  const colors = await extractLogoColors(bytes)
  const suggestions = paletteAlternatives(defaultTokens, colors.map((color) => color.hex))

  await prisma.brandProfile.upsert({
    where: { projectId },
    create: {
      projectId,
      logoAssetId: asset.id,
      tokens: JSON.parse(JSON.stringify({ ...suggestions[0]?.tokens, logoColors: colors.map((color) => color.hex) })),
    },
    update: {
      logoAssetId: asset.id,
      tokens: JSON.parse(JSON.stringify({ ...suggestions[0]?.tokens, logoColors: colors.map((color) => color.hex) })),
    },
  })

  return Response.json({ asset, colors, suggestions })
}
