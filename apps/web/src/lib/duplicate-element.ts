import { getAtPointer } from './json-pointer'

export function duplicableElement(path: string, props: Record<string, unknown>) {
  if (/^\/(cta|primaryCta|secondaryCta)$/.test(path)) return 'button'
  if (/^\/extraElements\/\d+$/.test(path)) return (getAtPointer(props, path) as { kind?: string })?.kind
  if (path.startsWith('/extraElements/')) return undefined
  if (path === '/imageUrl' && (props.imageLayout === 'background' || props.sectionBackgroundMode === 'image')) return undefined
  if (/imageUrl$/.test(path) || /^\/images\/\d+\/url$/.test(path)) return 'image'
  if (typeof getAtPointer(props, path) === 'string' && /\/(heading|body|intro|eyebrow|title|description|quote|author|source|question|answer|tagline|label|value|text)$/.test(path) && !/^\/(cta|primaryCta|secondaryCta)\//.test(path)) return 'text'
  return undefined
}
export function duplicateElement(props: Record<string, unknown>, path: string) {
  const kind = duplicableElement(path, props)
  if (!kind) return undefined
  const extras = (props.extraElements ?? []) as Array<Record<string, unknown>>
  if (extras.length >= 100) return undefined
  const value = getAtPointer(props, path)
  const original = /^\/extraElements\//.test(path) ? value as Record<string, unknown> : undefined
  const source = String(original?.source ?? path)
  const index = extras.length
  const nextPath = `/extraElements/${index}`
  const extra = { ...(original ?? {}), id: crypto.randomUUID(), source, kind,
    ...(kind === 'button' ? { label: `${String((value as { label?: string })?.label || 'Button').replace(/ \(copy \d+\)$/, '')} (copy ${index + 1})`, href: '' } : kind === 'image' ? { imageUrl: original?.imageUrl ?? value } : { text: original?.text ?? value }) }
  const colors = (props.elementColors ?? {}) as Record<string, unknown>
  const sizes = (props.imageSizes ?? {}) as Record<string, unknown>
  return { path: nextPath, props: { ...props, extraElements: [...extras, extra], elementColors: { ...colors, ...(colors[path] ? { [nextPath]: structuredClone(colors[path]) } : {}) }, imageSizes: { ...sizes, ...(sizes[path] ? { [nextPath]: structuredClone(sizes[path]) } : {}) } } }
}
