// Only unwrap dedicated image frames, never a layout containing other content.
export function imageResizeTarget(element: HTMLElement): HTMLElement | undefined {
  if (element.matches('img,[role="img"]')) return element
  if (element.hasAttribute('data-awb-image-container')) return Array.from(element.children).find((child) => child.matches('img,[role="img"]')) as HTMLElement | undefined
  if (element.hasAttribute('data-awb-free-item')) {
    const children = Array.from(element.children).filter(child => child.tagName !== 'STYLE')
    if (children.length === 1) return imageResizeTarget(children[0] as HTMLElement)
  }
  return undefined
}
