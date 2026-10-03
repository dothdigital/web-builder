import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createImageThumbnail } from '@/lib/image-thumbnail'
import { prisma } from '@awb/database'
import { getStorage, localUploadRoot } from '@awb/shared'
import { requireProject } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProject(id)
  const url = new URL(request.url).searchParams.get('url')
  if (!url) return new Response('Missing image', { status: 400 })
  const asset = await prisma.asset.findFirst({ where: { projectId: id, url }, select: { storageKey: true, mimeType: true } })
  if (!asset) return new Response('Image not found', { status: 404 })
  try {
    const readableUrl = await getStorage().readUrl(asset.storageKey)
    let bytes: Uint8Array<ArrayBuffer>
    let contentType = asset.mimeType || 'application/octet-stream'
    if (readableUrl.startsWith('/uploads/')) {
      const root = path.resolve(localUploadRoot())
      const target = path.resolve(root, asset.storageKey)
      if (!target.startsWith(`${root}${path.sep}`)) return new Response('Image not found', { status: 404 })
      bytes = new Uint8Array(await readFile(target))
    } else {
      const response = await fetch(readableUrl, { signal: AbortSignal.timeout(20000), cache: 'no-store' })
      if (!response.ok) return new Response('Image temporarily unavailable', { status: 502 })
      bytes = new Uint8Array(await response.arrayBuffer())
      contentType = response.headers.get('content-type') || contentType
    }
    if (new URL(request.url).searchParams.get('thumbnail') === '1') {
      bytes = await createImageThumbnail(bytes)
      contentType = 'image/webp'
    }
    return new Response(bytes, { headers: { 'Content-Type': contentType, 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'private, no-store' } })
  } catch {
    return new Response('Image temporarily unavailable. Please retry.', { status: 502 })
  }
}
