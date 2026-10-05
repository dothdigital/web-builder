import { rateLimit } from '@/lib/account-security'
import { sameOriginRequest } from '@/lib/request-origin'
import { AssetKind, AssetSource, WorkspaceRole, prisma } from '@awb/database'
import { assetKey, extractLogoColors, getStorage, MAX_IMAGE_BYTES, normalizeUploadedImage } from '@awb/shared'
import { paletteAlternatives } from '@awb/ai'
import { defaultTokens } from '@awb/component-registry'
import { requireProject, requireUser, withApiAuthorization } from '@/lib/tenancy'
import { readBoundedBody, RequestBodyTooLarge } from '@/lib/request-body'
import { assetReadUrl } from '@/lib/asset-read-url'

export const runtime = 'nodejs'

/// Uploads an image or logo for a project. When the upload is a logo we also
/// return a palette derived from it plus alternatives, so onboarding can offer
/// colours instead of asking the user to invent them.
async function handlePOST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 65536) return Response.json({ error: 'Choose an image under 5 MB.' }, { status: 413 })
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const user = await requireUser()
  try { await rateLimit(`image-upload:${user.id}`, 30) }
  catch { return Response.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 }) }
  let form: FormData
  try { const bytes = await readBoundedBody(request, MAX_IMAGE_BYTES + 65536); form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData() }
  catch (error) { return Response.json({ error: 'Invalid or oversized upload' }, { status: error instanceof RequestBodyTooLarge ? 413 : 400 }) }
  const projectId = String(form.get('projectId') ?? '')
  const kind = String(form.get('kind') ?? 'IMAGE') === 'LOGO' ? AssetKind.LOGO : AssetKind.IMAGE
  const file = form.get('file')

  if (!projectId || !(file instanceof File)) {
    return Response.json({ error: 'projectId and file are required' }, { status: 400 })
  }

  const { project } = await requireProject(projectId, WorkspaceRole.EDITOR)
  if (!file.size || file.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Choose an image under 5 MB.' }, { status: 413 })
  let bytes: Buffer
  try { bytes = await normalizeUploadedImage(Buffer.from(await file.arrayBuffer())) }
  catch { return Response.json({ error: 'Choose a valid PNG, JPG, WebP, GIF, AVIF or SVG image.' }, { status: 400 }) }
  const storage = getStorage()
  const stored = await storage.put(assetKey(project.workspaceId, projectId, file.name.replace(/\.[^.]*$/, '') + '.png'), bytes, 'image/png')

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

  // A logo added after intake should preserve the client's chosen theme.
  if (form.get('preserveBrandColors') === 'true') {
    await prisma.brandProfile.upsert({
      where: { projectId },
      create: { projectId, logoAssetId: asset.id },
      update: { logoAssetId: asset.id },
    })
    if (form.get('suggestBrandColors') === 'true') {
      const colors = await extractLogoColors(bytes)
      const suggestions = paletteAlternatives(defaultTokens, colors.map((color) => color.hex))
      return Response.json({ asset, colors, suggestions })
    }
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

  return Response.json({ asset, previewUrl: await assetReadUrl(asset), colors, suggestions })
}

export const POST = withApiAuthorization(handlePOST)
