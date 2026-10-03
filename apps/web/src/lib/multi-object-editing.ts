import type { WebsiteSection } from '@awb/website-model'
import { editObjectProps, moveObject, objectScope, type Placement } from './object-editing'

export type ElementGroup = { id: string; paths: string[] }
export type MultiAction =
  | { type: 'style' | 'imageSize'; paths: string[]; value: Record<string, unknown> }
  | { type: 'delete' | 'group' | 'ungroup'; paths: string[] }
  | { type: 'resize'; items: Array<{ path: string; placement: Placement; scale: number; slot: import('@awb/component-registry').FlowSlot }> }
  | { type: 'move'; items: Array<{ path: string; placement: Placement; offset: { x: number; y: number; sectionWidth: number } }> }

export function applyMultiAction(sections: WebsiteSection[], id: string, action: MultiAction): WebsiteSection[] {
  const section = sections.find((entry) => entry.id === id)
  if (!section) return sections
  if (action.type === 'resize') {
    let next = sections
    const mapped = new Map<string, string>()
    for (const item of action.items) {
      const scope = objectScope(section.props, item.path)
      const result = moveObject(next, id, item.path, id, item.placement, false, item.slot)
      if (!result) return sections
      mapped.set(item.path, result.path)
      next = result.sections.map((entry) => {
        if (entry.id !== id) return entry
        const free = [...entry.props.freeElements as Array<Record<string, unknown>>]
        const index = Number(result.path.split('/')[2])
        free[index] = { ...free[index], contentScale: Math.max(0.1, Math.min(10, (scope.entry?.contentScale ?? 1) * item.scale)) }
        return { ...entry, props: { ...entry.props, freeElements: free } }
      })
    }
    return next.map((entry) => entry.id !== id ? entry : { ...entry, props: { ...entry.props, elementGroups: ((section.props.elementGroups ?? []) as ElementGroup[]).map((group) => ({ ...group, paths: group.paths.map((path) => mapped.get(path) ?? path) })) } })
  }
  if (action.type === 'move') {
    let next = sections
    for (const item of action.items) {
      const result = moveObject(next, id, item.path, id, item.placement, false, undefined, item.offset)
      if (!result) return sections // All-or-nothing, including undo history.
      next = result.sections
    }
    return next
  }
  let props = section.props
  const paths = [...new Set(action.paths)]
  if (action.type === 'group' || action.type === 'ungroup') {
    const groups = ((props.elementGroups ?? []) as ElementGroup[]).filter((group) => !group.paths.some((path) => paths.includes(path)))
    if (action.type === 'group' && paths.length > 1) groups.push({ id: crypto.randomUUID(), paths })
    props = { ...props, elementGroups: groups }
  } else {
    for (const path of paths) props = editObjectProps(props, path, action.type === 'style' || action.type === 'imageSize' ? { type: action.type, value: action.value } : { type: 'delete' })
    if (action.type === 'delete') props = { ...props, elementGroups: ((props.elementGroups ?? []) as ElementGroup[]).map((group) => ({ ...group, paths: group.paths.filter((path) => !paths.includes(path)) })).filter((group) => group.paths.length > 1) }
  }
  return sections.map((entry) => entry.id === id ? { ...entry, props } : entry)
}

export type SelectionBox = { path: string; x: number; y: number; width: number; height: number }
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical'
export function alignSelection(boxes: SelectionBox[], alignment: Alignment): SelectionBox[] {
  if (boxes.length < 2) return boxes
  const left = Math.min(...boxes.map((box) => box.x)), right = Math.max(...boxes.map((box) => box.x + box.width))
  const top = Math.min(...boxes.map((box) => box.y)), bottom = Math.max(...boxes.map((box) => box.y + box.height))
  if (alignment === 'horizontal' || alignment === 'vertical') {
    const horizontal = alignment === 'horizontal', axis = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height'
    const sorted = [...boxes].sort((a, b) => a[axis] - b[axis])
    const span = horizontal ? right - left : bottom - top
    const gap = Math.max(0, (span - sorted.reduce((sum, box) => sum + box[size], 0)) / (boxes.length - 1))
    let cursor = horizontal ? left : top
    const positions = new Map(sorted.map((box) => { const position = cursor; cursor += box[size] + gap; return [box.path, position] }))
    return boxes.map((box) => ({ ...box, [axis]: positions.get(box.path)! }))
  }
  return boxes.map((box) => ({ ...box,
    x: alignment === 'left' ? left : alignment === 'center' ? (left + right - box.width) / 2 : alignment === 'right' ? right - box.width : box.x,
    y: alignment === 'top' ? top : alignment === 'middle' ? (top + bottom - box.height) / 2 : alignment === 'bottom' ? bottom - box.height : box.y,
  }))
}
