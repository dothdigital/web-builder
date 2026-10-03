/** Database JSON objects can return their keys in a different order. */
export function sameEditorValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((entry, index) => sameEditorValue(entry, b[index]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = Object.entries(a).filter(([, value]) => value !== undefined)
    const right = Object.entries(b).filter(([, value]) => value !== undefined)
    return left.length === right.length && left.every(([key, value]) => Object.hasOwn(b, key) && sameEditorValue(value, (b as Record<string, unknown>)[key]))
  }
  return false
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function ids(value: unknown[]): string[] | undefined {
  const result = value.map(entry => record(entry) && typeof entry.id === 'string' ? entry.id : undefined)
  return result.every((id): id is string => id !== undefined) && new Set(result).size === result.length ? result : undefined
}
/** Apply only the AI's delta to the latest draft. Never overwrite a competing edit. */
export function mergeAssistantChanges<T>(before: T, proposed: T, current: T, path = 'page'): T {
  if (sameEditorValue(before, proposed)) return current
  if (sameEditorValue(before, current) || sameEditorValue(proposed, current)) return proposed
  const conflict = () => { throw new Error(`The ${path.split('/').at(-1) || 'selected content'} changed while I was working. I kept your edit. Ask me again to revise its latest version.`) }
  if (Array.isArray(before) && Array.isArray(proposed) && Array.isArray(current)) {
    const originalIds = ids(before), proposedIds = ids(proposed), currentIds = ids(current)
    if (!originalIds || !proposedIds || !currentIds) return conflict()
    const reordered = !sameEditorValue(originalIds, proposedIds)
    if (reordered && !sameEditorValue(originalIds, currentIds) && !sameEditorValue(proposedIds, currentIds)) return conflict()
    const order = reordered ? proposedIds : currentIds
    // A concurrent removal must not discard an AI edit to that same object.
    for (const id of originalIds) if (!currentIds.includes(id) && !sameEditorValue(before[originalIds.indexOf(id)], proposed[proposedIds.indexOf(id)])) return conflict()
    // A requested removal must not discard newer changes to that object.
    for (const id of originalIds) if (!proposedIds.includes(id) && !sameEditorValue(before[originalIds.indexOf(id)], current[currentIds.indexOf(id)])) return conflict()
    return order.map(id => mergeAssistantChanges(before[originalIds.indexOf(id)], proposed[proposedIds.indexOf(id)], current[currentIds.indexOf(id)], `${path}/${id}`)) as T
  }
  if (record(before) && record(proposed) && record(current)) {
    if (before.componentId !== current.componentId && before.componentId !== undefined) return conflict()
    // Style maps use numeric object paths. A reordered list must not redirect
    // a pending style edit to a different card/text box at the same index.
    for (const key of ['elementColors', 'imageSizes', 'elementOffsets']) {
      const oldStyles = record(before[key]) ? before[key] : {}
      const newStyles = record(proposed[key]) ? proposed[key] : {}
      for (const pointer of new Set([...Object.keys(oldStyles), ...Object.keys(newStyles)])) {
        if (sameEditorValue(oldStyles[pointer], newStyles[pointer])) continue
        let oldNode: unknown = before, liveNode: unknown = current
        for (const token of pointer.split('/').slice(1)) {
          oldNode = oldNode && typeof oldNode === 'object' ? (oldNode as Record<string, unknown>)[token] : undefined
          liveNode = liveNode && typeof liveNode === 'object' ? (liveNode as Record<string, unknown>)[token] : undefined
          if (/^\d+$/.test(token)) {
            if (record(oldNode) && record(liveNode) && typeof oldNode.id === 'string') { if (oldNode.id !== liveNode.id) return conflict() }
            else if (!sameEditorValue(oldNode, liveNode)) return conflict()
          }
        }
      }
    }
    const result: Record<string, unknown> = {}
    for (const key of new Set([...Object.keys(before), ...Object.keys(proposed), ...Object.keys(current)])) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return conflict()
      const value = mergeAssistantChanges(before[key], proposed[key], current[key], `${path}/${key}`)
      if (value !== undefined) result[key] = value
    }
    return result as T
  }
  return conflict()
}
