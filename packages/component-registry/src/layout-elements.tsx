import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { Container, Section, Media } from './primitives'
import { elementColor } from './element-colors'

// Stable structural paths include React's null slots so toggling optional copy
// does not rename the neighbouring boxes. Semantic paths always take priority.
export function annotateLayout(tree: ReactNode, props: Record<string, unknown>, prefix = '/layout'): ReactNode {
  return Children.map(tree, (child, index) => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    const path = `${prefix}/${index}`
    const box = element.type === Container || element.type === Section || typeof element.type === 'string' && ['div', 'article', 'section', 'form', 'nav', 'aside', 'header', 'footer'].includes(element.type)
    const appearance = elementColor(props, path)
    const children = Children.toArray(element.props.children as ReactNode)
    const onlyChild = children.length === 1 && isValidElement(children[0]) ? children[0] as ReactElement<Record<string, unknown>> : undefined
    const imagePath = onlyChild?.props['data-awb-element'] as string | undefined
    const imageContainer = element.type === 'div' && onlyChild && (onlyChild.type === Media || onlyChild.type === 'img') && imagePath && (element.props.style as CSSProperties | undefined)?.position !== 'absolute'
    const size = imageContainer ? (props.imageSizes as Record<string, { width?: number; height?: number }> | undefined)?.[imagePath] : undefined
    const next = box && !element.props['data-awb-element'] && element.props.children ? { 'data-awb-element': path, style: { ...(element.props.style as CSSProperties), ...appearance } } : {}
    if (imageContainer && (props.removedElements as string[] | undefined)?.includes(imagePath) && !(props.flowSlots as Record<string, unknown> | undefined)?.[imagePath]) {
      return cloneElement(element, { ...next, style: { ...(next.style ?? element.props.style as CSSProperties), display: 'none' } }, annotateLayout(element.props.children as ReactNode, props, path))
    }
    if (imageContainer) {
      Object.assign(next, { 'data-awb-image-container': imagePath })
      if (size?.width !== undefined || size?.height !== undefined) {
        next.style = { ...(element.props.style as CSSProperties), ...appearance, ...(size.width !== undefined ? { width: `${size.width}%`, minWidth: 0, maxWidth: '100%' } : {}), height: 'auto', minHeight: 0, maxHeight: 'none', aspectRatio: 'auto', alignSelf: 'center' }
        const image = cloneElement(onlyChild!, onlyChild!.type === Media ? { sizeStyle: { ...(onlyChild!.props.sizeStyle as CSSProperties), width: '100%' } } : { style: { ...(onlyChild!.props.style as CSSProperties), width: '100%' } })
        return cloneElement(element, next, annotateLayout(image, props, path))
      }
    }
    return element.props.children !== undefined ? cloneElement(element, next, annotateLayout(element.props.children as ReactNode, props, path)) : cloneElement(element, next)
  })
}
export type LayoutNode = { path: string; label: string; children: LayoutNode[] }
export function layoutNodes(tree: ReactNode): LayoutNode[] {
  const result: LayoutNode[] = []
  Children.forEach(tree, (child) => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<Record<string, unknown>>
    const path = element.props['data-awb-element'] as string | undefined
    const children = layoutNodes(element.props.children as ReactNode)
    if (path?.startsWith('/layout/')) result.push({ path, label: element.props['data-awb-image-container'] ? 'Image container' : element.type === Section ? 'Section box' : element.type === Container ? 'Content container' : 'Layout box', children })
    else result.push(...children)
  })
  return result
}
