import type { DesignTokens, WebsiteModel } from '@awb/website-model'

type Palette = DesignTokens['palette']
const hex = /^#[\da-f]{6}$/i
const channels = (color: string) => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16))
function luminance(color: string) {
  const [r, g, b] = channels(color).map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return r! * 0.2126 + g! * 0.7152 + b! * 0.0722
}
function readable(background: string, palette: Palette) {
  const contrast = (color: string) => (Math.max(luminance(background), luminance(color)) + 0.05) / (Math.min(luminance(background), luminance(color)) + 0.05)
  return [palette.foreground, palette.primaryForeground, '#ffffff', '#111111'].sort((a, b) => contrast(b) - contrast(a))[0]!
}

// Recolor only component style fields; never rewrite content, URLs or scripts.
export function applySitePalette(model: WebsiteModel, palette: Palette): WebsiteModel {
  function mapColor(color: string, key: string): string {
    if (/border/i.test(key)) return palette.border
    const roles: Array<keyof Palette> = /background|overlay/i.test(key)
      ? ['background', 'surface', 'primary', 'accent', 'foreground']
      : ['foreground', 'muted', 'primary', 'accent', 'primaryForeground']
    const source = channels(color)
    const distance = (role: keyof Palette) => channels(model.tokens.palette[role]).reduce((sum, channel, index) => sum + (channel - source[index]!) ** 2, 0)
    roles.sort((a, b) => distance(a) - distance(b))
    return palette[roles[0]!]
  }
  function recolor(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(recolor)
    if (!value || typeof value !== 'object') return value
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = (key === 'color' || key.endsWith('Color')) && typeof item === 'string' && hex.test(item)
        ? mapColor(item, key) : recolor(item)
    }
    for (const [backgroundKey, textKey] of [['backgroundColor', 'color'], ['overlayColor', 'textColor'], ['sectionBackgroundColor', 'sectionBackgroundTextColor']]) {
      const background = result[backgroundKey!]
      if (typeof background === 'string' && hex.test(background) && typeof result[textKey!] === 'string') result[textKey!] = readable(background, palette)
    }
    return result
  }
  const update = <T extends { props: Record<string, unknown> }>(component: T): T => ({ ...component, props: recolor(component.props) as Record<string, unknown> })
  const tokens = { ...model.tokens, palette }
  delete tokens.buttons
  return {
    ...model,
    tokens,
    globalComponents: { header: update(model.globalComponents.header), footer: update(model.globalComponents.footer) },
    pages: model.pages.map(page => ({ ...page, sections: page.sections.map(update) })),
  }
}
