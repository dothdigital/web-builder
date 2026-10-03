import type { DesignTokens } from '@awb/website-model'

export interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToHsl(hex: string): Hsl {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: l * 100 }
  }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number

  if (max === r) {
    h = 60 * (((g - b) / delta) % 6)
  } else if (max === g) {
    h = 60 * ((b - r) / delta + 2)
  } else {
    h = 60 * ((r - g) / delta + 4)
  }

  return { h: (h + 360) % 360, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const saturation = Math.min(Math.max(s, 0), 100) / 100
  const lightness = Math.min(Math.max(l, 0), 100) / 100
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - c / 2
  const segments: Array<[number, number, number]> = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = segments[Math.floor(((h % 360) + 360) % 360 / 60) % 6] as [number, number, number]

  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)

  return (lighter + 0.05) / (darker + 0.05)
}

/// Picks whichever of black/white text passes best on the given background.
export function readableForeground(background: string): string {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#111111') ? '#ffffff' : '#111111'
}

/// Builds a full token palette from colours extracted from an uploaded logo.
/// The result is a *suggestion*: the user can accept, tweak or replace it.
export function paletteFromLogoColors(colors: string[], base: DesignTokens): DesignTokens {
  const [primaryHex, secondaryHex] = colors
  if (!primaryHex) {
    return base
  }

  const primary = hexToHsl(primaryHex)
  const accentSource = secondaryHex ? hexToHsl(secondaryHex) : { ...primary, h: (primary.h + 32) % 360 }
  const neutral: Hsl = { h: primary.h, s: Math.min(primary.s * 0.14, 12), l: 97 }
  const surface: Hsl = { h: primary.h, s: Math.min(primary.s * 0.2, 16), l: 94 }
  const foreground: Hsl = { h: primary.h, s: Math.min(primary.s * 0.3, 22), l: 12 }

  const primaryHexNormalized = hslToHex({ ...primary, l: Math.min(Math.max(primary.l, 18), 46) })

  return {
    ...base,
    palette: {
      background: hslToHex(neutral),
      surface: hslToHex(surface),
      foreground: hslToHex(foreground),
      muted: hslToHex({ ...foreground, l: 46, s: Math.min(foreground.s, 14) }),
      primary: primaryHexNormalized,
      primaryForeground: readableForeground(primaryHexNormalized),
      accent: hslToHex({ ...accentSource, l: Math.min(Math.max(accentSource.l, 38), 62) }),
      border: hslToHex({ ...surface, l: 86 }),
    },
  }
}

export interface PaletteSuggestion {
  id: string
  label: string
  rationale: string
  tokens: DesignTokens
}

/// Alternatives offered next to the logo-derived palette so the user always has
/// a choice instead of a single take-it-or-leave-it suggestion.
export function paletteAlternatives(base: DesignTokens, logoColors: string[]): PaletteSuggestion[] {
  const suggestions: PaletteSuggestion[] = []

  if (logoColors.length > 0) {
    suggestions.push({
      id: 'logo',
      label: 'From your logo',
      rationale: 'Built from the dominant colours we extracted from your logo.',
      tokens: paletteFromLogoColors(logoColors, base),
    })

    const primary = hexToHsl(logoColors[0] as string)
    const invertedPrimary = hslToHex({ ...primary, l: 14, s: Math.min(primary.s, 30) })

    suggestions.push({
      id: 'logo-dark',
      label: 'Logo, dark surfaces',
      rationale: 'Same hue family on a dark canvas for a more dramatic feel.',
      tokens: {
        ...base,
        palette: {
          background: invertedPrimary,
          surface: hslToHex({ ...primary, l: 20, s: Math.min(primary.s, 26) }),
          foreground: '#f7f5f2',
          muted: '#b8b2ab',
          primary: '#f7f5f2',
          primaryForeground: invertedPrimary,
          accent: hslToHex({ ...primary, l: 58, s: Math.max(primary.s, 45) }),
          border: hslToHex({ ...primary, l: 28, s: Math.min(primary.s, 24) }),
        },
      },
    })
  }

  suggestions.push({
    id: 'neutral-editorial',
    label: 'Neutral editorial',
    rationale: 'Warm neutrals that let photography carry the colour.',
    tokens: base,
  })

  return suggestions
}
