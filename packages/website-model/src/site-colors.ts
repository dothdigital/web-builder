import type { WebsiteModel } from './model'

// Read style fields only: a heading containing a hex code is still content.
export function normalizeSiteColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const text = value.trim().toLowerCase()
  if (/^#[\da-f]{3}$/.test(text)) return '#' + text.slice(1).split('').map(c => c + c).join('')
  if (/^#[\da-f]{6}$/.test(text)) return text
  const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (rgb && (!rgb[4] || Number(rgb[4]) === 1) && rgb.slice(1, 4).every(channel => Number(channel) <= 255)) return '#' + rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')
}

function visitStyleColors(value: unknown, visit: (color: string) => string): unknown {
  if (Array.isArray(value)) return value.map(item => visitStyleColors(item, visit))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const color = (key === 'color' || key.endsWith('Color')) ? normalizeSiteColor(item) : undefined
    return [key, color ? visit(color) : visitStyleColors(item, visit)]
  }))
}

export function siteColors(model: WebsiteModel): string[] {
  const colors = new Set<string>()
  for (const value of [...Object.values(model.tokens.palette), ...Object.values(model.tokens.buttons ?? {})]) {
    const color = normalizeSiteColor(value)
    if (color) colors.add(color)
  }
  const collect = (color: string) => { colors.add(color); return color }
  visitStyleColors(model.globalComponents, collect)
  for (const page of model.pages) visitStyleColors(page.sections, collect)
  return [...colors]
}

export function replaceSiteColor(model: WebsiteModel, source: string, replacement: string): WebsiteModel {
  const from = normalizeSiteColor(source)
  const to = normalizeSiteColor(replacement)
  if (!from || !to) return model
  const replace = (color: string) => color === from ? to : color
  const values = <T extends Record<string, string>>(fields: T): T => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, normalizeSiteColor(value) === from ? to : value])) as T
  return {
    ...model,
    tokens: { ...model.tokens, palette: values(model.tokens.palette), ...(model.tokens.buttons ? { buttons: values(model.tokens.buttons) } : {}) },
    globalComponents: visitStyleColors(model.globalComponents, replace) as WebsiteModel['globalComponents'],
    pages: model.pages.map(page => ({ ...page, sections: visitStyleColors(page.sections, replace) as typeof page.sections })),
  }
}
