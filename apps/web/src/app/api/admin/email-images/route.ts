import { sameOriginRequest } from '@/lib/request-origin'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/tenancy'
import { readBoundedBody, RequestBodyTooLarge } from '@/lib/request-body'
import { getStorage } from '@awb/shared'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  await requireAdmin()
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 5 * 1024 * 1024 + 65536) return Response.json({ error: 'Choose an image under 5 MB.' }, { status: 413 })
  let form: FormData
  try { const bytes = await readBoundedBody(request, 5 * 1024 * 1024 + 65536); form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData() }
  catch (error) { return Response.json({ error: 'Invalid or oversized upload' }, { status: error instanceof RequestBodyTooLarge ? 413 : 400 }) }
  const file = form.get('file')
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return Response.json({ error: 'Choose a JPG, PNG, WebP or GIF under 5 MB.' }, { status: 400 })
  try {
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25000000 }).timeout({ seconds: 10 }).rotate().resize({ width: 1200, withoutEnlargement: true }).png().toBuffer()
    const name = `${randomUUID()}.png`
    await getStorage().put(`marketing/${name}`, image, 'image/png')
    return Response.json({ src: `/api/email-images/${name}` })
  } catch { return Response.json({ error: 'This image could not be saved. Try another image.' }, { status: 400 }) }
}
