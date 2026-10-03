import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { z } from 'zod'

export const freeElementSchema = z.object({
  id: z.string().max(100),
  copied: z.boolean().optional(),
  zIndex: z.number().int().min(0).max(10000).optional(),
  contentScale: z.number().min(0.1).max(10).optional(),
  componentId: z.string().max(100),
  source: z.string().regex(/^\/[a-zA-Z0-9_/-]+$/),
  content: z.record(z.string(), z.unknown()),
  x: z.number().min(0).max(90),
  y: z.number().min(0).max(10000),
  width: z.number().min(10).max(100),
  height: z.number().min(24).max(3000),
})
export const freeElementsSchema = z.array(freeElementSchema).max(100).default([])
export type FreeElement = z.infer<typeof freeElementSchema>

// Work on React's trusted component tree, never user-supplied HTML. Components
// carrying an editable path retain their type, children and interactive behavior.
export function findElement(tree: ReactNode, path: string): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement(child)) continue
    const element = child as ReactElement<Record<string, unknown>>
    if (element.props['data-awb-element'] === path) return element
    const found = findElement(element.props.children as ReactNode, path)
    if (found) return found
  }
  return undefined
}
export function remapElement(tree: ReactNode, prefix: string, removed: string[] = [], copied = false): ReactNode {
  return Children.map(tree, (child) => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    const path = element.props['data-awb-element'] as string | undefined
    if (path && removed.some((entry) => path === entry || path.startsWith(`${entry}/`))) return null
    const next = { ...(path ? { 'data-awb-element': `${prefix}${path}` } : {}), ...(copied && element.props.level === 1 ? { level: 2 } : {}), ...(prefix && element.props.id ? { id: `${String(element.props.id)}-${prefix.replaceAll('/', '-')}` } : {}) }
    return element.props.children !== undefined
      ? cloneElement(element, next, remapElement(element.props.children as ReactNode, prefix, removed, copied))
      : cloneElement(element, next)
  })
}

export function FreeLayout({ children, elements, render, removed = [], minimumHeight = 0 }: { minimumHeight?: number; children: ReactNode; elements: FreeElement[]; removed?: string[]; render: (entry: FreeElement) => ReactNode }) {
  if (!elements.length && !minimumHeight) return children
  const visible = elements.map((entry, index) => ({ entry, index })).filter(({ index }) => !removed.includes(`/freeElements/${index}`))
  return <div data-awb-free-layout="true" style={{ position: 'relative', containerType: 'inline-size' }}>
    <style>{`[data-awb-free-base]>:not(style),[data-awb-free-base]>.awb-section-background>.awb-section-content,[data-awb-free-base]>.awb-section-background>.awb-section-content>:not(style){min-height:inherit;box-sizing:border-box}[data-awb-free-item]{position:absolute;z-index:2;left:var(--free-x);top:var(--free-y);width:var(--free-width);height:var(--free-height);overflow:visible;overflow-wrap:anywhere;box-sizing:border-box}[data-awb-free-item]>:not(style){width:calc(100% / var(--free-scale,1))!important;min-width:0;max-width:none;height:calc(var(--free-height) / var(--free-scale,1))!important;transform:scale(var(--free-scale,1));transform-origin:top left;min-height:0!important;margin:0;box-sizing:border-box}[data-awb-free-item]>[data-awb-image-container]>img,[data-awb-free-item]>[data-awb-image-container]>[role="img"]{width:100%!important;max-width:100%;height:100%!important;min-height:0;aspect-ratio:auto}[data-awb-free-item]>img{height:calc(var(--free-height) / var(--free-scale,1))!important;aspect-ratio:auto;object-fit:cover}`}</style>
    <div data-awb-free-base="true" style={{ minHeight: Math.max(minimumHeight, ...visible.map(({ entry }) => entry.y + entry.height)) }}>{children}</div>
    {visible.map(({ entry, index }) => <div key={entry.id} data-awb-free-item="true" data-awb-element={`/freeElements/${index}`} style={{ zIndex: entry.zIndex ?? 2, '--free-scale': entry.contentScale ?? 1, '--free-x': `${Math.min(entry.x, 100 - entry.width)}%`, '--free-y': `${entry.y}px`, '--free-width': `${entry.width}%`, '--free-height': `${entry.height}px` } as React.CSSProperties}>{remapElement(render(entry), `/freeElements/${index}/content`, (entry.content.removedElements ?? []) as string[], entry.copied)}</div>)}
  </div>
}
