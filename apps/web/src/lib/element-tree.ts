import { colorTargets, componentLayoutNodes, getComponent, type FreeElement } from '@awb/component-registry'
import { getAtPointer } from './json-pointer'

export interface ElementNode { path: string; label: string; children: ElementNode[] }
export function sectionElementTree(componentId: string, props: Record<string, unknown>): ElementNode[] {
  const roots: ElementNode[] = []
  const known = new Map<string, ElementNode>()
  const add = (path: string, label: string) => {
    if (known.has(path)) return known.get(path)!
    const node: ElementNode = { path, label, children: [] }
    const parentPath = path.slice(0, path.lastIndexOf('/'))
    const parent = parentPath ? known.get(parentPath) ?? add(parentPath, parentPath === '/primaryCta' ? 'Primary button' : parentPath === '/secondaryCta' ? 'Secondary button' : parentPath === '/cta' ? 'Button' : parentPath.split('/').pop()!) : undefined
    ;(parent?.children ?? roots).push(node)
    known.set(path, node)
    return node
  }
  const walk = (path: string, label: string, value: unknown) => {
    add(path, label)
    if (Array.isArray(value)) value.forEach((item, index) => {
      const title = componentId === 'ManualSection' && item && typeof item === 'object' ? `${(item as Record<string, unknown>).kind}: ${String((item as Record<string, unknown>).text || (item as Record<string, unknown>).label || '').slice(0, 45)}` : item && typeof item === 'object' ? (item as Record<string, unknown>).title ?? (item as Record<string, unknown>).author ?? (item as Record<string, unknown>).label : item
      walk(`${path}/${index}`, `${String(index + 1).padStart(2, '0')} · ${String(title || 'Item')}`, item)
    })
    else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value).filter(([key]) => !['id', 'source', 'kind'].includes(key))) walk(`${path}/${key}`, key === 'href' ? 'Link' : key === 'body' || key === 'description' ? 'Description' : key === 'imageUrl' ? 'Image' : key, entry)
  }
  for (const field of getComponent(componentId)?.editorFields ?? []) {
    if (field.path.startsWith('/sectionBackground') || ['color', 'range', 'select', 'boolean'].includes(field.type)) continue
    walk(field.path, field.label, getAtPointer(props, field.path))
  }
  for (const target of colorTargets(componentId, props)) {
    const label = target.path.endsWith('/number') ? 'Step number' : target.label
    walk(target.path, label, getAtPointer(props, target.path))
    known.get(target.path)!.label = label
  }
  if (componentId.startsWith('Header')) for (const [path, node] of known) {
    if (!path.startsWith('/items/')) continue
    const value = getAtPointer(props, path)
    if (value && !Array.isArray(value) && typeof value === 'object') {
      const label = (value as Record<string, unknown>).label
      if (typeof label === 'string' && label.trim()) node.label = label.trim()
    }
    if (path.endsWith('/children')) {
      const parent = getAtPointer(props, path.slice(0, -9)) as { label?: string } | undefined
      node.label = parent?.label ? `${parent.label} — submenu` : 'Submenu links'
    }
  }
  const filterVisible = (nodes: ElementNode[]): ElementNode[] => nodes.filter((node) => !((props.removedElements ?? []) as string[]).some(path => node.path === path || node.path.startsWith(`${path}/`))).map((node) => ({ ...node, children: filterVisible(node.children) }))
  const manualNames: Record<string, string> = { form: 'Form', heading: 'Heading', text: 'Paragraph', image: 'Image', bullets: 'Bullets', numbered: 'Numbered list', button: 'Button', quote: 'Quote', divider: 'Divider', spacer: 'Spacer', embed: 'HTML / Embed', columns: 'Columns', social: 'Social', menu: 'Menu' }
  const manualNodes: ElementNode[] = componentId === 'ManualSection' && Array.isArray(props.items) ? props.items.map((item: Record<string, unknown>, index: number) => {
    const path = `/items/${index}`, kind = String(item.kind)
    const child = ['heading', 'text', 'bullets', 'numbered', 'quote'].includes(kind) ? { path: `${path}/text`, label: 'Text content', children: [] } : kind === 'image' ? { path: `${path}/imageUrl`, label: 'Image', children: [] } : undefined
    return { path: child?.path ?? path, label: `${manualNames[kind] ?? 'Object'}${item.text && ['heading', 'text', 'quote'].includes(kind) ? ` — ${String(item.text).slice(0, 45)}` : ''}`, children: [] }
  }) : []
  const visible = filterVisible(componentId === 'ManualSection' ? manualNodes : [...roots, ...componentLayoutNodes(componentId, props)])
  for (const [index, entry] of ((props.freeElements ?? []) as FreeElement[]).entries()) {
    const path = `/freeElements/${index}`
    if (((props.removedElements ?? []) as string[]).includes(path)) continue
    const sourceTree = sectionElementTree(entry.componentId, { ...entry.content, freeElements: [] })
    const find = (nodes: ElementNode[]): ElementNode | undefined => { for (const node of nodes) { if (node.path === entry.source) return node; const found = find(node.children); if (found) return found } }
    const original = find(sourceTree)
    const prefix = (node: ElementNode): ElementNode => ({ ...node, path: `${path}/content${node.path}`, children: node.children.map(prefix) })
    visible.push({ path, label: `Moved object · ${original?.label ?? entry.source.split('/').pop()}`, children: original ? [prefix(original)] : [] })
  }
  return visible
}
