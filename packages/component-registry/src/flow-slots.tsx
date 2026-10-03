import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { z } from 'zod'

export const flowSlotSchema = z.object({
  width: z.number().min(0).max(20000),
  height: z.number().min(0).max(20000),
  display: z.enum(['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'list-item', 'inline']).default('block'),
  marginTop: z.number().min(-10000).max(10000).default(0),
  marginRight: z.number().min(-10000).max(10000).default(0),
  marginBottom: z.number().min(-10000).max(10000).default(0),
  marginLeft: z.number().min(-10000).max(10000).default(0),
})
export const flowSlotsSchema = z.record(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/), flowSlotSchema).default({})
export type FlowSlot = z.infer<typeof flowSlotSchema>

// Keep the original grid/flex/flow footprint without duplicating its text,
// image requests, form fields, IDs, or accessibility-tree content.
export function applyFlowSlots(tree: ReactNode, props: Record<string, unknown>): ReactNode {
  const removed = (props.removedElements ?? []) as string[]
  const slots = flowSlotsSchema.parse(props.flowSlots)
  const walk = (nodes: ReactNode): ReactNode => Children.map(nodes, (child) => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    const path = element.props['data-awb-element'] as string | undefined
    if (path && removed.includes(path)) {
      const slot = slots[path]
      if (!slot) return null
      const style = element.props.style as CSSProperties | undefined
      const Tag = slot.display.startsWith('inline') ? 'span' : 'div'
      return <Tag data-awb-flow-slot="true" aria-hidden="true" style={{
        gridColumn: style?.gridColumn, gridRow: style?.gridRow, order: style?.order,
        position: style?.position, inset: style?.inset, top: style?.top, right: style?.right, bottom: style?.bottom, left: style?.left,
        ...slot, display: slot.display === 'inline' ? 'inline-block' : slot.display,
        maxWidth: '100%', boxSizing: 'border-box', flexGrow: 0, flexShrink: 0,
        visibility: 'hidden', pointerEvents: 'none',
      }} />
    }
    return element.props.children !== undefined ? cloneElement(element, {}, walk(element.props.children as ReactNode)) : element
  })
  return walk(tree)
}
