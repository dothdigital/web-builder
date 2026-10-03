import type { ObjectAction } from './object-editing'

// Resize the image's frame against the section, never against its old column.
export function imagePlacementAction(element: HTMLElement, section: HTMLElement, sectionId: string, size: { width: number; height?: number }): ObjectAction {
  const container = element.parentElement?.hasAttribute('data-awb-image-container') ? element.parentElement : element
  const free = container.parentElement?.hasAttribute('data-awb-free-item') ? container.parentElement : container.hasAttribute('data-awb-free-item') ? container : undefined
  const frame = free ?? container
  const bounds = frame.getBoundingClientRect(), sectionBounds = section.getBoundingClientRect()
  const width = Math.max(10, Math.min(100, size.width))
  const style = getComputedStyle(frame)
  return { type: 'move', sourcePath: frame.dataset.awbElement, targetId: sectionId,
    placement: { width, height: Math.max(24, Math.min(3000, size.height ?? bounds.height)), x: Math.max(0, Math.min(100 - width, (bounds.left - sectionBounds.left) / Math.max(1, sectionBounds.width) * 100)), y: Math.max(0, Math.min(10000, bounds.top - sectionBounds.top)) },
    sourceSlot: { width: bounds.width, height: bounds.height, display: 'block', marginTop: parseFloat(style.marginTop) || 0, marginBottom: parseFloat(style.marginBottom) || 0, marginLeft: parseFloat(style.marginLeft) || 0, marginRight: parseFloat(style.marginRight) || 0 },
  }
}
