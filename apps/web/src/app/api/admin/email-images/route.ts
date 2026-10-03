import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/tenancy'
import { getStorage } from '@awb/shared'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  await requireAdmin()
  if (Number(request.headers.get('content-length')) > 9 * 1024 * 1024) return Response.json({ error: 'Choose an image under 8 MB.' }, { status: 413 })
  const form = await request.formData(); const file = form.get('file')
  if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return Response.json({ error: 'Choose a JPG, PNG, WebP or GIF under 8 MB.' }, { status: 400 })
  try {
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25000000 }).rotate().resize({ width: 1200, withoutEnlargement: true }).png().toBuffer()
    const name = `${randomUUID()}.png`
    await getStorage().put(`marketing/${name}`, image, 'image/png')
    return Response.json({ src: `/api/email-images/${name}` })
  } catch { return Response.json({ error: 'This image could not be saved. Try another image.' }, { status: 400 }) }
}
