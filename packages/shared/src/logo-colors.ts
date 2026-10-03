import sharp from 'sharp'

export interface ExtractedColor {
  hex: string
  /// Share of sampled pixels, 0-1.
  weight: number
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function saturationOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const lightness = (max + min) / 2

  if (max === min) {
    return 0
  }

  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
}

/// Extracts the dominant colours of an uploaded logo by quantising pixels into
/// coarse buckets, dropping transparent and near-white/near-black pixels, and
/// ranking what is left by weighted coverage. Chromatic buckets are boosted so
/// a logo that is mostly white with a coloured mark still yields its brand hue.
export async function extractLogoColors(input: Buffer, maxColors = 5): Promise<ExtractedColor[]> {
  const { data, info } = await sharp(input)
    .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buckets = new Map<string, { r: number; g: number; b: number; count: number; score: number }>()
  const channels = info.channels
  let sampled = 0

  for (let offset = 0; offset < data.length; offset += channels) {
    const r = data[offset] as number
    const g = data[offset + 1] as number
    const b = data[offset + 2] as number
    const alpha = channels === 4 ? (data[offset + 3] as number) : 255

    if (alpha < 128) {
      continue
    }

    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
    const saturation = saturationOf(r, g, b)

    if (lightness > 246 || lightness < 9) {
      continue
    }

    sampled += 1

    const key = `${r >> 4}-${g >> 4}-${b >> 4}`
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0, score: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count += 1
    bucket.score += 1 + saturation * 2
    buckets.set(key, bucket)
  }

  if (sampled === 0) {
    return []
  }

  return [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxColors)
    .map((bucket) => ({
      hex: toHex(
        Math.round(bucket.r / bucket.count),
        Math.round(bucket.g / bucket.count),
        Math.round(bucket.b / bucket.count),
      ),
      weight: bucket.count / sampled,
    }))
}
