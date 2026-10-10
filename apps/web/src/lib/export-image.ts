import sharp from 'sharp'

/** Optimize only bundled copies; retain the original uploaded files. */
export async function exportImage(bytes: Buffer, name: string): Promise<{ bytes: Buffer; name: string }> {
  if (bytes.length < 300000 || !/\.(png|jpe?g|webp|avif)$/i.test(name)) return { bytes, name }
  const image = sharp(bytes, { animated: true })
  const metadata = await image.metadata()
  if ((metadata.pages ?? 1) > 1) return { bytes, name }
  const optimized = await sharp(bytes).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  return optimized.length < bytes.length ? { bytes: optimized, name: name.replace(/\.[^.]+$/, '.webp') } : { bytes, name }
}
