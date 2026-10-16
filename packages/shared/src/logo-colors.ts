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
/// buckets, ignoring transparent pixels and preferring chromatic pixels, and
/// ranking distinct shades by weighted coverage. Chromatic buckets are boosted so
/// a logo that is mostly white with a coloured mark still yields its brand hue.
export async function extractLogoColors(input: Buffer, maxColors = 5): Promise<ExtractedColor[]> {
  const { data, info } = await sharp(input)
    .rotate()
    .toColourspace('srgb')
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const neutrals = new Map<string, { r: number; g: number; b: number; count: number; score: number }>()
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

    sampled += 1

    const key = `${r >> 4}-${g >> 4}-${b >> 4}`
    const target = lightness > 246 || lightness < 9 ? neutrals : buckets
    const bucket = target.get(key) ?? { r: 0, g: 0, b: 0, count: 0, score: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count += 1
    bucket.score += 1 + saturation * 2
    target.set(key, bucket)
  }

  if (sampled === 0) {
    return []
  }

  // Merge nearby shades before selecting colours so gradients do not crowd
  // a second brand hue out of the result. Keep a representative original shade.
  const candidates = [...(buckets.size ? buckets : neutrals).values()]
    .sort((a, b) => b.score - a.score)
    .map(bucket => ({
      hex: toHex(Math.round(bucket.r / bucket.count), Math.round(bucket.g / bucket.count), Math.round(bucket.b / bucket.count)),
      weight: bucket.count / sampled,
    }))
  const distinct: ExtractedColor[] = []
  for (const color of candidates) {
    const lab = toLab(color.hex)
    const match = distinct.find(item => {
      const other = toLab(item.hex)
      return Math.hypot(lab[0] - other[0], lab[1] - other[1], lab[2] - other[2]) < 22
    })
    if (match) match.weight += color.weight
    else distinct.push({ ...color })
  }
  return distinct.sort((a, b) => b.weight - a.weight).slice(0, Math.max(0, maxColors))
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const f = (value: number) => value > 216 / 24389 ? Math.cbrt(value) : value * 841 / 108 + 4 / 29
  const x = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047)
  const y = f(r * 0.2126729 + g * 0.7151522 + b * 0.0721750)
  const z = f((r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
