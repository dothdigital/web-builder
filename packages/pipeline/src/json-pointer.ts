type Json = unknown

function tokens(pointer: string): string[] {
  return pointer
    .split('/')
    .slice(1)
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'))
}

export function getAtPointer(target: Json, pointer: string): Json {
  let cursor: Json = target

  for (const token of tokens(pointer)) {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(token)]
    } else if (cursor && typeof cursor === 'object') {
      cursor = (cursor as Record<string, Json>)[token]
    } else {
      return undefined
    }

    if (cursor === undefined) {
      return undefined
    }
  }

  return cursor
}

/// Immutable pointer write: the editor keeps every model revision in a history
/// stack, so mutation in place would break undo.
export function setAtPointer<T>(target: T, pointer: string, value: Json): T {
  const path = tokens(pointer)

  if (path.length === 0) {
    return value as T
  }

  const clone = (node: Json): Json => (Array.isArray(node) ? [...node] : { ...(node as Record<string, Json>) })
  const root = clone(target as Json)
  let cursor = root as Record<string, Json> | Json[]

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]!
    const container = Array.isArray(cursor) ? cursor[Number(key)] : (cursor as Record<string, Json>)[key]
    const next = container && typeof container === 'object' ? clone(container) : {}

    if (Array.isArray(cursor)) {
      cursor[Number(key)] = next
    } else {
      cursor[key] = next
    }

    cursor = next as Record<string, Json> | Json[]
  }

  const last = path[path.length - 1]!

  if (Array.isArray(cursor)) {
    if (value === undefined) {
      cursor.splice(Number(last), 1)
    } else {
      cursor[Number(last)] = value
    }
  } else if (value === undefined) {
    delete (cursor as Record<string, Json>)[last]
  } else {
    ;(cursor as Record<string, Json>)[last] = value
  }

  return root as T
}
