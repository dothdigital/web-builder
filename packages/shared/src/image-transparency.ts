import sharp from 'sharp'
/** Require actual visible subject and transparent pixels, not a painted backdrop. */
export async function assertTransparentImage(bytes: Buffer): Promise<void> {
  const image = sharp(bytes)
  const metadata = await image.metadata()
  if (metadata.format !== 'png' || !metadata.hasAlpha) throw new Error('The generated image did not include PNG transparency. Your existing image has been kept. Try generating again.')
  const stats = await image.stats()
  const alpha = stats.channels[stats.channels.length - 1]!
  if (alpha.min >= 255 || alpha.max === 0) throw new Error('The generated image did not contain a visible subject on a transparent background. Your existing image has been kept. Try generating again.')
}
