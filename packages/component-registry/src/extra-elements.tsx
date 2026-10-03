import { Children, cloneElement, Fragment, isValidElement, type ReactNode, type ReactElement, type CSSProperties } from 'react'
import { z } from 'zod'
import { elementColor } from './element-colors'
import { imageSizing } from './image-sizing'

export const extraElementsSchema = z.array(z.object({
  id: z.string(), source: z.string().regex(/^\/[a-zA-Z0-9_/-]+$/),
  kind: z.enum(['text', 'button', 'image']), text: z.string().optional(),
  label: z.string().optional(), href: z.string().optional(), imageUrl: z.string().optional(),
})).max(100).default([])

export function insertExtraElements(tree: ReactNode, props: Record<string, unknown>): ReactNode {
  const extras = extraElementsSchema.parse(props.extraElements)
  if (!extras.length) return tree
  const inserted = new Set<string>()
  const walk = (children: ReactNode): ReactNode => Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    const source = element.props['data-awb-element'] as string | undefined
    const original = element.props.children ? cloneElement(element, {}, walk(element.props.children as ReactNode)) : element
    if (!source || inserted.has(source)) return original
    inserted.add(source)
    const matches = extras.map((extra, index) => ({ extra, index })).filter(({ extra }) => extra.source === source)
    if (!matches.length) return original
    return <Fragment>{original}{matches.map(({ extra, index }) => {
      const path = `/extraElements/${index}`
      const style = { ...(element.props.style as CSSProperties), ...elementColor(props, path) }
      const common = { key: extra.id, 'data-awb-element': path, style }
      if (extra.kind === 'button') return cloneElement(element, { ...common, label: extra.label, href: extra.href || undefined, ...(typeof element.type === 'string' ? { children: extra.label } : {}) })
      if (extra.kind === 'image') return cloneElement(element, { ...common, src: extra.imageUrl, sizeStyle: imageSizing(props, path) })
      return cloneElement(element, { ...common, ...(element.props.level === 1 ? { level: 2 } : {}) }, extra.text)
    })}</Fragment>
  })
  return walk(tree)
}
