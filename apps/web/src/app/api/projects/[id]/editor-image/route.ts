import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createImageThumbnail } from '@/lib/image-thumbnail'
import { prisma } from '@awb/database'
import { localUploadRoot, readPublicImage, IMAGE_CONTENT_POLICY } from '@awb/shared'
import { assetReadUrl } from '@/lib/asset-read-url'
import { requireProject, withApiAuthorization } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProject(id)
  const url = new URL(request.url).searchParams.get('url')
  if (!url) return new Response('Missing image', { status: 400 })
  const asset = await prisma.asset.findFirst({ where: { projectId: id, url }, select: { url: true, storageKey: true, mimeType: true } })
  if (!asset) return new Response('Image not found', { status: 404 })
  try {
    const readableUrl = await assetReadUrl(asset)
    let bytes: Uint8Array<ArrayBuffer>
    let contentType = asset.mimeType || 'application/octet-stream'
    if (readableUrl.startsWith('/uploads/')) {
      const root = path.resolve(localUploadRoot())
      const target = path.resolve(root, asset.storageKey)
      if (!target.startsWith(`${root}${path.sep}`)) return new Response('Image not found', { status: 404 })
      bytes = new Uint8Array(await readFile(target))
    } else {
      const image = await readPublicImage(readableUrl)
      bytes = new Uint8Array(image.bytes)
      contentType = image.contentType
    }
    if (new URL(request.url).searchParams.get('thumbnail') === '1') {
      bytes = await createImageThumbnail(bytes)
      contentType = 'image/webp'
    }
    return new Response(bytes, { headers: { 'Content-Type': contentType, 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'private, no-store', 'Content-Security-Policy': IMAGE_CONTENT_POLICY, 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return new Response('Image temporarily unavailable. Please retry.', { status: 502 })
  }
}

export const GET = withApiAuthorization(handleGET)
