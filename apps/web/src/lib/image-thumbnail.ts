import sharp from 'sharp'

export async function createImageThumbnail(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const output = await sharp(bytes).rotate().resize({ width: 480, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
  return new Uint8Array(output)
}
