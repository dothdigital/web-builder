export function reorderElementColors(colors: Record<string, unknown>, path: string, previous: unknown[], next: unknown[]): Record<string, unknown> {
  const used = new Set<number>()
  const positions = previous.map((item) => {
    const position = next.findIndex((candidate, index) => !used.has(index) && candidate === item)
    if (position >= 0) used.add(position)
    return position
  })
  if (previous.length === next.length) positions.forEach((position, index) => { if (position < 0 && !used.has(index)) { positions[index] = index; used.add(index) } })
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(colors)) {
    if (!key.startsWith(`${path}/`)) { result[key] = value; continue }
    const [index, ...rest] = key.slice(path.length + 1).split('/')
    const position = positions[Number(index)]
    if (position !== undefined && position >= 0) result[`${path}/${position}${rest.length ? `/${rest.join('/')}` : ''}`] = value
  }
  return result
}
