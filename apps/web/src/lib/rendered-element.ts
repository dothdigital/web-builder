// Templates can render the same property in desktop and mobile markup. Bind
// controls to the visible instance rather than the first (possibly hidden) one.
export function renderedElement(node: HTMLElement, path: string) {
  return Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]')).find(element => {
    if (element.dataset.awbElement !== path) return false
    const bounds = element.getBoundingClientRect()
    return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  })
}
