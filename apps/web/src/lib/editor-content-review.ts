import { getComponent, siteChrome } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { getAtPointer } from './json-pointer'
import { resolveSectionMedia } from './section-media'

export interface ReviewField {
  id: string
  pageId: string
  pageTitle: string
  sectionId: string
  globalSlot?: 'header' | 'footer'
  sectionTitle: string
  pointer: string
  label: string
  kind: 'image' | 'text'
  value: string
  empty: boolean
}
const textKeys = new Set(['heading', 'title', 'body', 'intro', 'description', 'text', 'question', 'answer', 'quote'])
const escapePointer = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1')
export const isReviewImagePointer = (pointer: string) => /\/(?:imageUrl|logoImageUrl|backgroundImageUrl|sectionBackgroundImageUrl)$/.test(pointer) || /\/images\/\d+\/url$/.test(pointer)

/** Inspect the effective images a visitor sees, while retaining canonical edit targets. */
export function reviewEditorContent(model: WebsiteModel): ReviewField[] {
  const result: ReviewField[] = []
  const chrome = siteChrome(model)
  const scopes = model.pages.flatMap(page => page.sections.map(section => ({ page, section, globalSlot: undefined as 'header' | 'footer' | undefined })))
  if (model.pages[0]) for (const slot of ['header', 'footer'] as const) scopes.push({ page: { ...model.pages[0], title: `Site ${slot}` }, section: { ...model.globalComponents[slot], id: slot, hidden: false, props: chrome[slot] } as typeof scopes[number]['section'], globalSlot: slot })
  for (const { page, section, globalSlot } of scopes) {
    if (section.hidden) continue
    const props = resolveSectionMedia(model, page, section)
    const definition = getComponent(section.componentId)
    if (!definition) continue
    const fields = new Map<string, { label: string; kind: 'image' | 'text' }>()
    const removed = Array.isArray(props.removedElements) ? props.removedElements as string[] : []
    const add = (pointer: string, label: string, kind: 'image' | 'text') => {
      if (removed.some(path => pointer === path || pointer.startsWith(`${path}/`))) return
      if (pointer.endsWith('/sectionBackgroundImageUrl') && getAtPointer(props, pointer.replace(/sectionBackgroundImageUrl$/, 'sectionBackgroundMode')) !== 'image') return
      if (!fields.has(pointer)) fields.set(pointer, { label, kind })
    }
    for (const field of definition.editorFields) {
      if (field.type === 'image') add(field.path, field.label, 'image')
      if (['text', 'textarea'].includes(field.type) && textKeys.has(field.path.split('/').pop()!)) add(field.path, field.label, 'text')
    }
    const walk = (value: unknown, pointer = '', ownerLabel = '') => {
      if (Array.isArray(value)) { value.forEach((entry, index) => walk(entry, `${pointer}/${index}`, `${ownerLabel || 'Item'} ${index + 1}`)); return }
      if (!value || typeof value !== 'object') return
      const record = value as Record<string, unknown>
      // List schemas often omit optional image keys entirely, not just leave them blank.
      if (/\/images\/\d+$/.test(pointer)) add(`${pointer}/url`, `${ownerLabel || 'Gallery'} · Image`, 'image')
      if (/\/items\/\d+$/.test(pointer) && (record.kind === 'image' || ['SERVICES', 'PORTFOLIO', 'CREDENTIALS'].includes(definition.family))) add(`${pointer}/imageUrl`, `${String(record.title || ownerLabel || 'Item')} · Image`, 'image')
      const title = typeof record.title === 'string' && record.title.trim() ? record.title : ownerLabel
      const manualKeys: Record<string, string[]> = { heading: ['text'], text: ['text'], bullets: ['text'], numbered: ['text'], quote: ['text'], image: ['imageUrl'], columns: ['columns'], menu: ['links'], social: ['links'], form: ['formFields'], button: [], divider: [], spacer: [], embed: [] }
      const activeKeys = typeof record.kind === 'string' && /\/items\/\d+$/.test(pointer) ? manualKeys[record.kind] : undefined
      for (const [key, entry] of Object.entries(record)) {
        if (activeKeys && !activeKeys.includes(key)) continue
        // Layout settings are not customer-facing content.
        if (['elementColors', 'elementOffsets', 'imageSizes', 'flowSlots', 'inlineLinks'].includes(key)) continue
        const child = `${pointer}/${escapePointer(key)}`
        if (isReviewImagePointer(child)) add(child, title ? `${title} · Image` : 'Image', 'image')
        else if (textKeys.has(key) && typeof entry === 'string') add(child, title && pointer ? `${title} · ${key}` : key, 'text')
        else walk(entry, child, title)
      }
    }
    walk(props)
    for (const [pointer, field] of fields) {
      const value = getAtPointer(props, pointer)
      if (typeof value !== 'string' && value !== undefined && value !== null) continue
      const text = typeof value === 'string' ? value : ''
      result.push({ ...field, id: `${page.id}:${section.id}:${pointer}`, ...(globalSlot ? { globalSlot } : {}), pageId: page.id, pageTitle: page.title, sectionId: section.id, sectionTitle: String(props.heading || props.title || definition.name), pointer, value: text, empty: !text.trim() })
    }
  }
  return result
}
