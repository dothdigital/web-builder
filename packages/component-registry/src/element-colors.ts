import type { CSSProperties } from 'react'
import { z } from 'zod'

export const elementColorsSchema = z.record(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/), z.object({
  zIndex: z.number().int().min(0).max(10000).optional(),
  layoutColumns: z.number().int().min(1).max(4).optional(),
  layoutGap: z.number().min(0).max(160).optional(),
  height: z.number().min(24).max(3000).optional(),
  paddingTop: z.number().min(0).max(400).optional(),
  paddingBottom: z.number().min(0).max(400).optional(),
  paddingLeft: z.number().min(0).max(400).optional(),
  paddingRight: z.number().min(0).max(400).optional(),
  marginTop: z.number().min(0).max(400).optional(),
  marginRight: z.number().min(0).max(400).optional(),
  marginBottom: z.number().min(0).max(400).optional(),
  marginLeft: z.number().min(0).max(400).optional(),
  widthBasis: z.enum(['parent', 'section']).optional(),
  width: z.number().min(10).max(100).optional(),
  fontFamily: z.string().max(200).regex(/^[a-zA-Z0-9 ,\-'"]+$/).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  borderRadius: z.number().min(0).max(200).optional(),
  borderWidth: z.number().min(0).max(20).optional(),
  borderStyle: z.enum(['solid', 'dashed', 'dotted', 'none']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  fontWeight: z.union([z.literal(400), z.literal(700)]).optional(),
  fontSize: z.number().min(10).max(160).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})).default({})

export function elementColor(props: unknown, path: string): CSSProperties {
  const { widthBasis, verticalAlign, layoutColumns, layoutGap, ...styles } = (props as { elementColors?: Record<string, CSSProperties & { layoutColumns?: number; layoutGap?: number; widthBasis?: 'parent' | 'section'; verticalAlign?: 'top' | 'middle' | 'bottom' }> }).elementColors?.[path] ?? {}
  const gap = layoutGap ?? 24
  const layout: CSSProperties = layoutColumns ? { display: 'grid', gridTemplateColumns: layoutColumns === 1 ? 'minmax(0, 1fr)' : `repeat(auto-fit, minmax(min(100%, max(180px, calc((100% - ${gap * (layoutColumns - 1)}px) / ${layoutColumns}))), 1fr))`, gridAutoFlow: 'row', gap, alignItems: 'start', justifyItems: 'stretch', height: 'auto', minHeight: 0 } : {}
  return { ...styles, ...(typeof styles.zIndex === 'number' ? { position: 'relative' as const } : {}), ...(typeof styles.height === 'number' ? { boxSizing: 'border-box' as const } : {}), ...(typeof styles.width === 'number' ? { width: widthBasis === 'section' ? `${styles.width}cqw` : `${styles.width}%`, minWidth: 0, maxWidth: widthBasis === 'section' ? '100cqw' : '100%', display: 'block', overflowWrap: 'anywhere' as const } : {}), ...(verticalAlign ? { display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch', justifyContent: verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start' } : {}), ...(styles.backgroundColor ? { background: styles.backgroundColor } : {}), ...(styles.borderColor ? { borderStyle: styles.borderStyle ?? 'solid', borderWidth: styles.borderWidth ?? '1px' } : {}), ...layout }
}

// Cards with their own surface should use theme text, not the section overlay text.
export function cardColor(props: unknown, path: string): CSSProperties {
  const styles = elementColor(props, path)
  return { color: 'var(--awb-card-fg, var(--awb-fg))', '--awb-muted': 'var(--awb-card-muted, var(--awb-muted))', ...styles,
    ...(styles.color ? { '--awb-muted': styles.color, '--awb-fg': styles.color } : {}),
  } as CSSProperties
}

export function colorTargets(componentId: string, props: Record<string, unknown>): Array<{ path: string; label: string; surface?: boolean }> {
  const supported = /^(Manual|Blog|Footer|Header|Hero|Services|About|Reviews|Contact|Cta|Faq|Gallery|Portfolio|Credentials)/.test(componentId)
  if (!supported) return []
  const targets: Array<{ path: string; label: string; surface?: boolean }> = []
  if (componentId === 'ManualSection' && Array.isArray(props.items)) props.items.forEach((item: Record<string, unknown>, index: number) => {
    const label = String(item.text || item.label || item.kind).slice(0, 60)
    targets.push({ path: `/items/${index}`, label: `${item.kind}: ${label}`, surface: true })
    if (['heading', 'text', 'bullets', 'numbered', 'quote'].includes(String(item.kind))) targets.push({ path: `/items/${index}/text`, label: `${label} — text` })
  })
  if (componentId.startsWith('Header')) {
    targets.push({ path: '/items', label: 'Navigation menu (all links)', surface: true })
    const menuTargets = (items: unknown, path: string, parents: string[]) => {
      if (!Array.isArray(items)) return
      items.forEach((item, index) => {
        if (!item || typeof item !== 'object') return
        const name = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Unnamed link ${index + 1}`
        const names = [...parents, name]
        targets.push({ path: `${path}/${index}/label`, label: names.join(' → '), surface: true })
        menuTargets(item.children, `${path}/${index}/children`, names)
      })
    }
    menuTargets(props.items, '/items', [])
  }
  for (const key of ['heading', 'body', 'intro', 'eyebrow']) if (typeof props[key] === 'string' && props[key]) targets.push({ path: `/${key}`, label: key === 'heading' ? 'Section heading' : key === 'eyebrow' ? 'Eyebrow text' : 'Section introduction' })
  for (const key of ['cta', 'primaryCta', 'secondaryCta']) if (props[key]) targets.push({ path: `/${key}`, label: key === 'primaryCta' ? 'Primary button' : key === 'secondaryCta' ? 'Secondary button' : 'Button', surface: true })
  const list = (componentId.startsWith('Services') || componentId === 'FaqAccordion' || componentId === 'PortfolioShowcase' || componentId === 'CredentialsShowcase') ? 'items' : componentId === 'AboutSplitOverlap' ? 'points' : componentId.startsWith('Reviews') ? 'testimonials' : undefined
  if (list && Array.isArray(props[list])) props[list].forEach((item: Record<string, unknown>, index: number) => {
    const label = String(item.title || item.question || item.author || `Card ${index + 1}`)
    targets.push({ path: `/${list}/${index}`, label: `${label} — card`, surface: true })
    if (list === 'points' && props.layout === 'steps') targets.push({ path: `/${list}/${index}/number`, label: `${label} — step number`, surface: true })
    if (list === 'testimonials') targets.push({ path: `/${list}/${index}/avatar`, label: `${label} — initials chip`, surface: true })
    for (const key of ['title', 'description', 'body', 'quote', 'author', 'source', 'question', 'answer', 'category', 'issuer', 'year', 'linkLabel']) if (typeof item[key] === 'string') targets.push({ path: `/${list}/${index}/${key}`, label: `${label} — ${key}` })
  })
  if (componentId === 'ContactSplit') {
    targets.push({ path: '/contact-panel', label: 'Contact information panel', surface: true }, { path: '/form', label: 'Enquiry form panel', surface: true }, { path: '/submitButton', label: 'Submit button', surface: true })
    if (Array.isArray(props.formFields)) props.formFields.forEach((field, index) => targets.push({ path: `/formFields/${index}/input`, label: `${(field as { label?: string }).label || `Field ${index + 1}`} — input`, surface: true }))
  }
  if (componentId === 'HeroTypographic' && Array.isArray(props.keywords)) props.keywords.forEach((keyword, index) => targets.push({ path: `/keywords/${index}`, label: `${String(keyword)} — chip`, surface: true }))
  const addText = (path: string, label: string) => { if (!targets.some((target) => target.path === path)) targets.push({ path, label }) }
  for (const key of ['businessName', 'tagline', 'logoText', 'address', 'phone', 'email', 'submitLabel', 'consentText']) if (typeof props[key] === 'string') addText(`/${key}`, key)
  if (Array.isArray(props.stats)) props.stats.forEach((_, index) => { addText(`/stats/${index}/label`, `Statistic ${index + 1} label`); addText(`/stats/${index}/value`, `Statistic ${index + 1} value`) })
  const walkLabels = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((entry, index) => walkLabels(entry, `${path}/${index}`))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, entry]) => {
      const next = `${path}/${key}`
      if (typeof entry === 'string' && ['label', 'title', 'day', 'value'].includes(key)) addText(next, next.slice(1).replaceAll('/', ' → '))
      else if (typeof entry === 'object') walkLabels(entry, next)
    })
  }
  for (const key of ['columns', 'legalLinks', 'hours', 'formFields', ...(componentId.startsWith('Header') ? ['items'] : [])]) walkLabels(props[key], `/${key}`)
  if (Array.isArray(props.extraElements)) props.extraElements.forEach((entry, index) => targets.push({ path: `/extraElements/${index}`, label: `Copy ${index + 1} — ${(entry as { kind?: string }).kind ?? 'element'}`, surface: true }))
  return targets
}
