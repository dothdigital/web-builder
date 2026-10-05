import { getComponent, findElement, defaultTokens, type FreeElement, type FlowSlot } from '@awb/component-registry'
import type { WebsiteSection } from '@awb/website-model'
import { getAtPointer, setAtPointer } from './json-pointer'

export type Placement = { x: number; y: number; width: number; height: number }
export type LayerDirection = 'forward' | 'backward' | 'front' | 'back' | 'reset'
export type ObjectAction =
  | { type: 'restoreSection' }
  | { type: 'layer'; direction: LayerDirection; sourcePath?: string }
  | { type: 'move'; sourcePath?: string; targetId: string; placement: Placement; sourceSlot?: FlowSlot; offset?: { x: number; y: number; sectionWidth?: number } }
  | { type: 'duplicate'; placement: Placement }
  | { type: 'delete' }
  | { type: 'fullWidth'; offsetX: number; height: number }
  | { type: 'style'; value: Record<string, unknown> }
  | { type: 'imageSize'; value: Record<string, unknown> }
  | { type: 'content'; pointer: string; value: unknown }
  | { type: 'placement'; value: Partial<Placement> }

export function objectScope(props: Record<string, unknown>, path: string) {
  const match = path.match(/^\/freeElements\/(\d+)(?:\/content(\/.*))?$/)
  const entry = match ? (props.freeElements as FreeElement[] | undefined)?.[Number(match[1])] : undefined
  return entry ? { props: entry.content, path: match![2] ?? entry.source, prefix: `/freeElements/${match![1]}/content`, entry, index: Number(match![1]), root: !match![2] || match![2] === entry.source } : { props, path, prefix: '', entry: undefined, index: -1, root: false }
}

export function restoreMovedSection(sections: WebsiteSection[], hostId: string, path: string, id: string): WebsiteSection[] {
  const host = sections.find((section) => section.id === hostId)
  if (!host || sections.some((section) => section.id === id)) return sections
  const scope = objectScope(host.props, path)
  if (!scope.root || scope.entry?.source !== '/layout/0') return sections
  const definition = getComponent(scope.entry.componentId)
  if (!definition?.propsSchema.safeParse(scope.entry.content).success) return sections
  // Keep indices stable for other moved objects and their saved selections.
  const removed = [...new Set([...(host.props.removedElements as string[] ?? []), `/freeElements/${scope.index}`])]
  const remaining = (host.props.freeElements as FreeElement[]).filter((_, index) => !removed.includes(`/freeElements/${index}`))
  const props = { ...host.props, removedElements: removed, freeLayoutMinHeight: Math.max(0, ...remaining.map((entry) => entry.y + entry.height)) }
  const restored: WebsiteSection = { id, componentId: scope.entry.componentId, componentVersion: '1.0.0', hidden: false, props: structuredClone(scope.entry.content) }
  return sections.flatMap((section) => section.id === hostId ? [restored, { ...section, props }] : [section])
}

export function editObjectProps(props: Record<string, unknown>, path: string, action: ObjectAction): Record<string, unknown> {
  if (action.type === 'layer') {
    path = action.sourcePath ?? path
    const target = objectScope(props, path)
    if (target.root && action.direction !== 'reset') {
      const entries = (props.freeElements ?? []) as FreeElement[]
      const order = entries.map((entry, index) => ({ index, level: entry.zIndex ?? 2 })).sort((a, b) => a.level - b.level || a.index - b.index).map((entry) => entry.index)
      const previous = order.indexOf(target.index)
      order.splice(previous, 1)
      const next = action.direction === 'front' ? order.length : action.direction === 'back' ? 0 : Math.max(0, Math.min(order.length, previous + (action.direction === 'forward' ? 1 : -1)))
      order.splice(next, 0, target.index)
      return { ...props, freeElements: entries.map((entry, index) => ({ ...entry, zIndex: order.indexOf(index) + 1 })) }
    }
    const styles = (target.props.elementColors ?? {}) as Record<string, Record<string, unknown>>
    const current = Number(target.root ? target.entry!.zIndex ?? 2 : styles[target.path]?.zIndex ?? 2)
    const levels = [...Object.values(styles).map((style) => Number(style.zIndex ?? 2)), ...((props.freeElements ?? []) as FreeElement[]).map((entry) => entry.zIndex ?? 2), 2]
    const zIndex = action.direction === 'reset' ? undefined : Math.max(0, Math.min(10000, action.direction === 'front' ? Math.max(...levels) + 1 : action.direction === 'back' ? 0 : current + (action.direction === 'forward' ? 1 : -1)))
    return target.root ? setAtPointer(props, `/freeElements/${target.index}/zIndex`, zIndex) : setAtPointer(props, `${target.prefix}/elementColors`, { ...styles, [target.path]: { ...styles[target.path], zIndex } })
  }
  const scope = objectScope(props, path)
  if (action.type === 'style' && scope.path === '/layout/0' && typeof action.value.backgroundColor === 'string') {
    const { backgroundColor, ...rest } = action.value
    const rootProps = scope.props.imageLayout === 'background'
      ? { ...scope.props, overlayColor: backgroundColor }
      : { ...scope.props, sectionBackgroundMode: 'colour', sectionBackgroundColor: backgroundColor }
    const next = scope.prefix ? setAtPointer(props, scope.prefix, rootProps) : rootProps
    return Object.keys(rest).length ? editObjectProps(next, path, { type: 'style', value: rest }) : next
  }
  if (action.type === 'fullWidth') {
    if (scope.root) return editObjectProps(props, path, { type: 'placement', value: { x: 0, width: 100 } })
    const styled = editObjectProps(props, path, { type: 'style', value: { width: 100, widthBasis: 'section', height: Math.max(24, Math.min(3000, action.height)) } })
    const offsets = (scope.props.elementOffsets ?? {}) as Record<string, { x: number; y: number; sectionX?: number }>
    const previous = offsets[scope.path] ?? { x: 0, y: 0 }
    return setAtPointer(styled, `${scope.prefix}/elementOffsets`, { ...offsets, [scope.path]: { x: Math.max(-20000, Math.min(20000, previous.x + action.offsetX)), y: previous.y, sectionX: 0 } })
  }
  if (action.type === 'delete') return { ...props, removedElements: [...new Set([...(props.removedElements as string[] ?? []), scope.root ? `/freeElements/${scope.index}` : path])] }
  if (action.type === 'content') return setAtPointer(props, action.pointer, action.value)
  if (action.type === 'placement' && scope.entry) {
    const next = { ...scope.entry, ...action.value }
    next.width = Math.max(10, Math.min(100, next.width)); next.x = Math.max(0, Math.min(100 - next.width, next.x)); next.y = Math.max(0, Math.min(10000, next.y)); next.height = Math.max(24, Math.min(3000, next.height))
    return setAtPointer(props, `/freeElements/${scope.index}`, next)
  }
  if (action.type === 'style' || action.type === 'imageSize') {
    const key = action.type === 'style' ? 'elementColors' : 'imageSizes'
    const styles = scope.props[key] as Record<string, Record<string, unknown>> ?? {}
    return setAtPointer(props, `${scope.prefix}/${key}`, { ...styles, [scope.path]: { ...styles[scope.path], ...action.value } })
  }
  return props
}

function copyContent(value: unknown, copyNumber: number): unknown {
  if (Array.isArray(value)) return value.map((entry) => copyContent(entry, copyNumber))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === 'href' ? '' : key === 'label' && typeof child === 'string' ? `${child.replace(/ \(copy(?: \d+)?\)$/, '')} (copy ${copyNumber})` : copyContent(child, copyNumber)]))
  return value
}

function reserveSectionHeight(props: Record<string, unknown>) {
  const elements = (props.freeElements ?? []) as FreeElement[]
  return { ...props, freeLayoutMinHeight: Math.max(Number(props.freeLayoutMinHeight ?? 0), ...elements.map((entry) => entry.y + entry.height)) }
}

export function moveObject(sections: WebsiteSection[], sourceId: string, path: string, targetId: string, placement: Placement, duplicate = false, sourceSlot?: FlowSlot, offset?: { x: number; y: number; sectionWidth?: number }): { sections: WebsiteSection[]; path: string } | undefined {
  const source = sections.find((entry) => entry.id === sourceId)
  const target = sections.find((entry) => entry.id === targetId)
  if (!source || !target || target.hidden) return undefined
  const scope = objectScope(source.props, path)
  const free = (target.props.freeElements ?? []) as FreeElement[]
  if (scope.root && sourceId === targetId && !duplicate) return { sections: sections.map((entry) => entry.id === sourceId ? { ...entry, props: editObjectProps(reserveSectionHeight(entry.props), path, { type: 'placement', value: placement }) } : entry), path: `/freeElements/${scope.index}` }
  if (sourceId === targetId && !duplicate && offset) {
    const offsets = (scope.props.elementOffsets ?? {}) as Record<string, { x: number; y: number; sectionX?: number }>
    const previous = offsets[scope.path] ?? { x: 0, y: 0 }
    const appearance = (scope.props.elementColors as Record<string, { widthBasis?: string; width?: number }> | undefined)?.[scope.path]
    const sectionWidth = appearance?.widthBasis === 'section' ? appearance.width ?? 100 : undefined
    const next = { x: Math.max(-20000, Math.min(20000, previous.x + offset.x)), y: Math.max(-20000, Math.min(20000, previous.y + offset.y)), ...(sectionWidth !== undefined ? { sectionX: Math.max(0, Math.min(100 - sectionWidth, (previous.sectionX ?? (100 - sectionWidth) / 2) + offset.x / Math.max(1, offset.sectionWidth ?? 1) * 100)) } : {}) }
    return { sections: sections.map((section) => section.id === sourceId ? { ...section, props: { ...setAtPointer(section.props, `${scope.prefix}/elementOffsets`, { ...offsets, [scope.path]: next }), ...(section.componentId === 'ManualSection' ? { freeLayoutMinHeight: Math.max(Number(section.props.freeLayoutMinHeight ?? 0), placement.y + placement.height + 16) } : {}) } } : section), path }
  }
  if (free.length >= 100) return undefined
  const content = structuredClone(scope.props)
  delete content.freeElements
  const sourceColors = content.elementColors as Record<string, Record<string, unknown>> | undefined
  if (sourceColors?.[scope.path]?.widthBasis === 'section') content.elementColors = { ...sourceColors, [scope.path]: { ...sourceColors[scope.path], widthBasis: 'parent', width: 100 } }
  // Detached placement supplies the new position; do not translate it twice.
  if (content.elementOffsets) { const offsets = { ...content.elementOffsets as Record<string, unknown> }; delete offsets[scope.path]; content.elementOffsets = offsets }
  // Outer visibility edits for detached children become local to the snapshot.
  if (scope.entry) {
    const removed = (source.props.removedElements ?? []) as string[]
    content.removedElements = [...(content.removedElements as string[] ?? []), ...removed.filter((item) => item.startsWith(`${scope.prefix}/`)).map((item) => item.slice(scope.prefix.length))]
  }
  const componentId = scope.entry?.componentId ?? source.componentId
  const definition = getComponent(componentId)
  const parsed = definition?.propsSchema.safeParse(content)
  if (!definition || !parsed?.success) return undefined
  // Avoid persisting an invisible or unsupported object (e.g. a list container
  // that has no editable renderer node).
  const tree = (definition.render as (args: { props: unknown; context: import('@awb/component-registry').RenderContext }) => React.ReactNode)({ props: parsed.data, context: { editing: true, baseUrl: '', tokens: defaultTokens } })
  if (!findElement(tree, scope.path)) return undefined
  const index = free.length
  const nextPath = `/freeElements/${index}`
  const entry: FreeElement = { zIndex: scope.entry?.zIndex ?? (scope.props.elementColors as Record<string, { zIndex?: number }> | undefined)?.[scope.path]?.zIndex, contentScale: scope.entry?.contentScale ?? 1, id: crypto.randomUUID(), copied: duplicate || scope.entry?.copied, componentId, source: scope.path, content: (duplicate ? copyContent(content, index + 1) : content) as Record<string, unknown>, ...placement }
  entry.width = Math.max(10, Math.min(100, entry.width)); entry.x = Math.max(0, Math.min(100 - entry.width, entry.x)); entry.y = Math.max(0, Math.min(10000, entry.y)); entry.height = Math.max(24, Math.min(3000, entry.height))
  return { path: nextPath, sections: sections.map((section) => {
    let props = section.props
    if (!duplicate && section.id === sourceId) {
      props = editObjectProps(reserveSectionHeight(props), path, { type: 'delete' })
      if (!scope.root) {
        const slot = sourceSlot ?? { width: 600, height: placement.height, display: 'block', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 }
        props = setAtPointer(props, `${scope.prefix}/flowSlots`, { ...(scope.props.flowSlots as Record<string, FlowSlot> ?? {}), [scope.path]: slot })
        // Detached children also need local removal for their placeholder to render.
        if (scope.prefix) props = setAtPointer(props, `${scope.prefix}/removedElements`, [...new Set([...(scope.props.removedElements as string[] ?? []), scope.path])])
      }
    }
    if (section.id === targetId) props = { ...props, freeElements: [...((props.freeElements ?? []) as FreeElement[]), entry] }
    return props === section.props ? section : { ...section, props }
  }) }
}

export function objectTextPointer(props: Record<string, unknown>, path: string) {
  const scope = objectScope(props, path)
  const value = getAtPointer(scope.props, scope.path)
  if (typeof value === 'string') return `${scope.prefix}${scope.path}`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (['heading', 'text', 'bullets', 'numbered', 'quote'].includes(String(record.kind)) && typeof record.text === 'string') return `${scope.prefix}${scope.path}/text`
    for (const key of ['label', 'text', 'imageUrl']) if (typeof record[key] === 'string') return `${scope.prefix}${scope.path}/${key}`
  }
  return undefined
}
