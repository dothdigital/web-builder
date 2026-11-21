import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { Container, Section, Media } from './primitives'
import { elementColor } from './element-colors'
import { BalancedGrid } from './balanced-grid'

type CardArrangement = { columns: number; gap?: number }

// A section's heading and introduction are not cards. Route its arrangement
// to the one card collection inside it, without narrowing the section itself.
function cardGridCount(tree: ReactNode): number {
  let count = 0
  Children.forEach(tree, child => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<{ children?: ReactNode }>
    // A separate hero/photo beside the collection is intentional split content.
    // Leave that container's own arrangement controls intact.
    count += element.type === BalancedGrid ? 1 : element.type === Media || element.type === 'img' ? 2 : cardGridCount(element.props.children)
  })
  return count
}

// Stable structural paths include React's null slots so toggling optional copy
// does not rename the neighbouring boxes. Semantic paths always take priority.
export function annotateLayout(tree: ReactNode, props: Record<string, unknown>, prefix = '/layout', inheritedCards?: CardArrangement): ReactNode {
  return Children.map(tree, (child, index) => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    const path = `${prefix}/${index}`
    const cardGrid = element.type === BalancedGrid
    const box = cardGrid || element.type === Container || element.type === Section || typeof element.type === 'string' && ['div', 'article', 'section', 'form', 'nav', 'aside', 'header', 'footer'].includes(element.type)
    const configured = (props.elementColors as Record<string, { layoutColumns?: number; layoutGap?: number }> | undefined)?.[path]
    const routesCards = box && !!configured?.layoutColumns && (cardGrid || cardGridCount(element.props.children as ReactNode) === 1)
    const cardArrangement = routesCards ? { columns: configured!.layoutColumns!, gap: configured!.layoutGap } : inheritedCards
    const appearance = elementColor(routesCards ? { ...props, elementColors: { ...(props.elementColors as object), [path]: { ...configured, layoutColumns: undefined, layoutGap: undefined } } } : props, path)
    const children = Children.toArray(element.props.children as ReactNode)
    const onlyChild = children.length === 1 && isValidElement(children[0]) ? children[0] as ReactElement<Record<string, unknown>> : undefined
    const imagePath = onlyChild?.props['data-awb-element'] as string | undefined
    const imageContainer = element.type === 'div' && onlyChild && (onlyChild.type === Media || onlyChild.type === 'img') && imagePath && (element.props.style as CSSProperties | undefined)?.position !== 'absolute'
    const size = imageContainer ? (props.imageSizes as Record<string, { width?: number; height?: number }> | undefined)?.[imagePath] : undefined
    const next = box && !element.props['data-awb-element'] && element.props.children ? { 'data-awb-element': path, style: { ...(element.props.style as CSSProperties), ...appearance } } : {}
    if (cardGrid && cardArrangement) Object.assign(next, { arrangement: cardArrangement })
    if (imageContainer && (props.removedElements as string[] | undefined)?.includes(imagePath) && !(props.flowSlots as Record<string, unknown> | undefined)?.[imagePath]) {
      return cloneElement(element, { ...next, style: { ...(next.style ?? element.props.style as CSSProperties), display: 'none' } }, annotateLayout(element.props.children as ReactNode, props, path, cardArrangement))
    }
    if (imageContainer) {
      Object.assign(next, { 'data-awb-image-container': imagePath })
      if (size?.width !== undefined || size?.height !== undefined) {
        next.style = { ...(element.props.style as CSSProperties), ...appearance, ...(size.width !== undefined ? { width: `${size.width}%`, minWidth: 0, maxWidth: '100%' } : {}), height: 'auto', minHeight: 0, maxHeight: 'none', aspectRatio: 'auto', alignSelf: 'center' }
        const image = cloneElement(onlyChild!, onlyChild!.type === Media ? { sizeStyle: { ...(onlyChild!.props.sizeStyle as CSSProperties), width: '100%' } } : { style: { ...(onlyChild!.props.style as CSSProperties), width: '100%' } })
        return cloneElement(element, next, annotateLayout(image, props, path, cardArrangement))
      }
    }
    return element.props.children !== undefined ? cloneElement(element, next, annotateLayout(element.props.children as ReactNode, props, path, cardArrangement)) : cloneElement(element, next)
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
