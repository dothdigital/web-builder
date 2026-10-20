import { addManualObject, type ManualObjectKind } from './add-manual-object'
import { reorderElementColors } from './element-color-order'
import type { WebsiteSection } from '@awb/website-model'

type Props = Record<string, unknown>
type Item = Record<string, unknown>
const maps = ['elementColors', 'imageSizes', 'elementOffsets', 'inlineLinks'] as const
export function columnCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error('Choose between 1 and 5 columns.')
  return count
}
export function setSectionColumns(props: Props, count: number): Props {
  count = columnCount(count)
  return { ...props, sectionColumns: count, items: ((props.items ?? []) as Item[]).map(item => ({ ...item, column: Math.min(Math.max(Number(item.column) || 1, 1), count) })) }
}
export function addColumnObject(props: Props, kind: ManualObjectKind, column: number): Props {
  if (column > columnCount(props.sectionColumns) || column < 1) throw new Error('Choose a column in this section.')
  const section = { id: 'column-section', componentId: 'ManualSection', componentVersion: '1.0.0', props } as WebsiteSection
  const added = addManualObject(section, kind, crypto.randomUUID(), 0).section.props as Props
  const items = [...added.items as Item[]]
  items[items.length - 1] = { ...items[items.length - 1], column }
  return { ...added, items }
}
export function copyColumnObjects(props: Props, indexes: number[], target: number): Props {
  const count = columnCount(props.sectionColumns)
  if (!Number.isInteger(target) || target < 1 || target > count) throw new Error('Choose a target column.')
  const items = (props.items ?? []) as Item[]
  if (items.length + indexes.length > 100) throw new Error('A section can contain up to 100 objects.')
  if (indexes.some(index => !Number.isInteger(index) || !items[index])) throw new Error('Select an existing object to copy.')
  let next: Props = { ...props, items: [...items] }
  for (const index of indexes) {
    const position = (next.items as Item[]).length
    ;(next.items as Item[]).push({ ...structuredClone(items[index]!), id: crypto.randomUUID(), column: target })
    const from = `/items/${index}`, to = `/items/${position}`
    for (const key of maps) {
      const styles = { ...(next[key] as Props ?? {}) }
      for (const [path, value] of Object.entries(props[key] as Props ?? {})) if (path === from || path.startsWith(`${from}/`)) styles[to + path.slice(from.length)] = structuredClone(value)
      next = { ...next, [key]: styles }
    }
    const extras = (next.extraElements ?? []) as Item[]
    const copies = ((props.extraElements ?? []) as Item[]).filter(entry => typeof entry.source === 'string' && (entry.source === from || entry.source.startsWith(`${from}/`))).map(entry => ({ ...structuredClone(entry), id: crypto.randomUUID(), source: to + String(entry.source).slice(from.length) }))
    if (extras.length + copies.length > 100) throw new Error('This copy would exceed the added-object limit.')
    if (copies.length) next = { ...next, extraElements: [...extras, ...copies] }
  }
  return next
}
export function copyColumn(props: Props, from: number, to: number): Props {
  return copyColumnObjects(props, ((props.items ?? []) as Item[]).flatMap((item, index) => Number(item.column ?? 1) === from ? [index] : []), to)
}
export function removeColumnObject(props: Props, index: number): Props {
  const previous = (props.items ?? []) as Item[], items = previous.filter((_, position) => position !== index)
  const next: Props = { ...props, items }
  for (const key of maps) next[key] = reorderElementColors(props[key] as Props ?? {}, '/items', previous, items)
  return next
}

// Text/image jobs may run on an older worker. Keep user-controlled column
// placement when applying its section result to the newer editor.
export function preserveColumnLayout(original: WebsiteSection, generated: WebsiteSection): WebsiteSection {
  if (original.componentId !== 'ManualSection' || !original.props.sectionColumns || generated.componentId !== 'ManualSection') return generated
  const items = (original.props.items ?? []) as Item[]
  const incoming = (generated.props.items ?? []) as Item[]
  return { ...generated, props: { ...generated.props, sectionColumns: original.props.sectionColumns, equalColumnWidths: original.props.equalColumnWidths ?? true, equalColumnHeights: original.props.equalColumnHeights ?? true, items: incoming.map((item, index) => ({ ...item, column: (items.find(entry => entry.id === item.id) ?? items[index])?.column ?? 1 })) } }
}
