import { getComponent, type FreeElement } from '@awb/component-registry'
import type { WebsiteSection } from '@awb/website-model'
export const objectChoices = [
  ['form', 'Form'], ['columns', 'Columns'], ['button', 'Button'], ['divider', 'Divider'], ['heading', 'Heading'], ['text', 'Paragraph'], ['image', 'Image'], ['social', 'Social'], ['menu', 'Menu'], ['embed', 'HTML / Embed'], ['bullets', 'Bullets'], ['numbered', 'Numbered list'], ['quote', 'Quote'], ['spacer', 'Spacer'],
] as const
export type ManualObjectKind = typeof objectChoices[number][0]
export function addManualObject(section: WebsiteSection, kind: ManualObjectKind, id: string, bottom: number) {
  const parsed = getComponent('ManualSection')!.propsSchema.parse({ items: [{ id, kind, text: kind === 'heading' ? 'Your heading' : ['bullets', 'numbered'].includes(kind) ? 'First item\nSecond item' : 'Write your content here.', height: kind === 'embed' ? 300 : 40, links: kind === 'menu' ? [{ label: 'Home', href: '/' }] : [] }] }) as { items: Record<string, unknown>[] }
  const item = parsed.items[0]!
  if (kind === 'form') Object.assign(item, { submitLabel: 'Submit', formFields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: false },
    { name: 'message', label: 'Message', type: 'textarea', required: true },
  ] })
  if (section.componentId === 'ManualSection') {
    const items = (section.props.items ?? []) as Record<string, unknown>[]
    if (items.length >= 100) throw new Error('This section already has 100 objects. Choose another section.')
    return { section: { ...section, props: { ...section.props, items: [...items, item] } }, path: `/items/${items.length}` }
  }
  const free = (section.props.freeElements ?? []) as FreeElement[]
  if (free.length >= 100) throw new Error('This section already has 100 added objects. Choose another section.')
  const y = Math.ceil(Math.max(bottom, Number(section.props.freeLayoutMinHeight ?? 0)) + 16)
  if (y > 10000) throw new Error('This section is too tall. Add a blank section instead.')
  const height = kind === 'form' ? 650 : ['image', 'embed', 'columns'].includes(kind) ? 300 : kind === 'divider' ? 32 : 120
  const entry: FreeElement = { id, componentId: 'ManualSection', source: '/items/0', content: { items: [item] }, x: 5, y, width: 90, height }
  return { section: { ...section, props: { ...section.props, freeElements: [...free, entry], freeLayoutMinHeight: y + height + 16 } }, path: `/freeElements/${free.length}` }
}
