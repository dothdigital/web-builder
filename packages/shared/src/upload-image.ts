import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_CONTENT_POLICY = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'"

// Never store executable SVG/HTML or trust the browser's MIME type.
export async function normalizeUploadedImage(bytes: Buffer): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Choose an image under 5 MB')
  const image = sharp(bytes, { limitInputPixels: 25000000, pages: 1 })
  const metadata = await image.metadata()
  if (!metadata.format || !['png', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(metadata.format)) throw new Error('Unsupported image')
  for (const width of [2400, 1600, 1000]) {
    const output = await image.clone().timeout({ seconds: 10 }).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    if (output.length <= MAX_IMAGE_BYTES) return output
  }
  throw new Error('Choose a smaller image')
}
