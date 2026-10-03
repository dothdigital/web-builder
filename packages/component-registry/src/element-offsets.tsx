import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { Prose } from './primitives'
import { z } from 'zod'

export const elementOffsetsSchema = z.record(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/), z.object({
  sectionX: z.number().min(0).max(100).optional(),
  x: z.number().min(-20000).max(20000),
  y: z.number().min(-20000).max(20000),
})).default({})

// Translate the existing node without removing it from its grid/flex/flow slot.
// Its intrinsic size and parent layout remain unchanged, including on resize.
export function applyElementOffsets(tree: ReactNode, props: Record<string, unknown>): ReactNode {
  const offsets = elementOffsetsSchema.parse(props.elementOffsets)
  const walk = (nodes: ReactNode, skipOffset?: string): { children: ReactNode; moved: boolean; expanded: boolean } => {
    let moved = false
    let expandedTree = false
    const children = Children.map(nodes, (child) => {
      if (!isValidElement(child)) return child
      const element = child as ReactElement<Record<string, unknown>>
      const path = element.props['data-awb-element'] as string | undefined
      const ownOffset = path && path !== skipOffset ? offsets[path] : undefined
      const imagePath = element.props['data-awb-image-container'] as string | undefined
      const imageOffset = imagePath ? offsets[imagePath] : undefined
      const offset = imageOffset ? { x: (ownOffset?.x ?? 0) + imageOffset.x, y: (ownOffset?.y ?? 0) + imageOffset.y } : ownOffset
      const nested = walk(element.props.children as ReactNode, imagePath)
      const appearance = path ? ((props.elementColors ?? {}) as Record<string, { widthBasis?: string; width?: number; height?: number; zIndex?: number }>)[path] : undefined
      const expanded = appearance?.widthBasis === 'section' && typeof appearance.width === 'number'
      const displaced = !!offset && (offset.x !== 0 || offset.y !== 0)
      moved ||= displaced || nested.moved || !!expanded
      expandedTree ||= !!expanded || nested.expanded
      const original = element.props.style as CSSProperties | undefined
      const geometry = displaced || expanded || appearance?.width !== undefined || appearance?.height !== undefined
      const spacing = Object.fromEntries(Object.entries(appearance ?? {}).filter(([key]) => /^(padding|margin)(Top|Right|Bottom|Left)$/.test(key)))
      const style: CSSProperties = { ...original, ...spacing,
        ...(geometry ? { '--awb-desktop-geometry': 1 } as CSSProperties : {}),
        ...(appearance?.zIndex !== undefined ? { position: original?.position ?? 'relative', zIndex: appearance.zIndex } : {}),
        ...(nested.expanded ? { minWidth: 0, position: 'static' } : {}),
        ...(nested.moved && (original?.overflow === 'hidden' || original?.overflow === 'clip' || original?.overflowX === 'hidden' || original?.overflowX === 'clip') ? { overflow: 'visible', overflowX: 'visible', overflowY: 'visible' } : {}),
        ...(displaced ? { translate: `${offset.x}px ${offset.y}px`, position: original?.position ?? 'relative', zIndex: appearance?.zIndex ?? original?.zIndex ?? 2 } : {}),
      }
      if (expanded) {
        const width = appearance!.width!
        const left = Math.max(0, Math.min(100 - width, offset?.sectionX ?? (100 - width) / 2))
        const margin = original?.margin ?? (element.type === Prose ? '1em 0' : 0)
        const wideStyle: CSSProperties = { ...style, position: 'absolute', left: `${left}%`, right: 'auto', top: 'auto', width: `${width}cqw`, maxWidth: '100cqw', margin: 0, ...spacing, translate: `0px ${offset?.y ?? 0}px`, zIndex: appearance?.zIndex ?? original?.zIndex ?? 2 }
        const content = element.props.children !== undefined ? cloneElement(element, { style: wideStyle }, nested.children) : cloneElement(element, { style: wideStyle })
        // Retain the original vertical slot, but anchor horizontal geometry to
        // the section boundary. Editor pixels must never position preview text.
        return <div data-awb-width-slot="true" style={{ height: appearance!.height ?? '1lh', margin, width: '100%', minWidth: 0 }}>{content}</div>
      }
      const next = geometry || nested.moved || appearance?.zIndex !== undefined || Object.keys(spacing).length > 0 ? { style } : {}
      return element.props.children !== undefined ? cloneElement(element, next, nested.children) : cloneElement(element, next)
    })
    return { children, moved, expanded: expandedTree }
  }
  return walk(tree).children
}
