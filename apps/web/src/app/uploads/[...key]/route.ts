import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { localUploadRoot } from '@awb/shared'

const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
}

/// Serves locally stored assets when no S3 bucket is configured. With a bucket
/// set, assets are served straight from S3/CDN and this route is unused.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const root = localUploadRoot()
  const target = path.resolve(root, ...key)

  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    return new Response('Not found', { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream

  return new Response(stream, {
    headers: {
      'content-type': contentTypes[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
