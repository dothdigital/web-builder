// A contained image can be much smaller than its CSS box (for example a wide
// banner inside a tall hero). Selection belongs to the painted image.
export function imageVisibleBounds(element: HTMLElement) {
  const bounds = element.getBoundingClientRect()
  if (!(element instanceof HTMLImageElement) || !element.naturalWidth || !element.naturalHeight) return bounds
  const style = getComputedStyle(element)
  if (style.objectFit !== 'contain' && style.objectFit !== 'scale-down') return bounds
  const scaleX = bounds.width / Math.max(1, element.offsetWidth)
  const scaleY = bounds.height / Math.max(1, element.offsetHeight)
  const number = (value: string) => parseFloat(value) || 0
  const leftInset = (number(style.borderLeftWidth) + number(style.paddingLeft)) * scaleX
  const topInset = (number(style.borderTopWidth) + number(style.paddingTop)) * scaleY
  const width = Math.max(0, bounds.width - leftInset - (number(style.borderRightWidth) + number(style.paddingRight)) * scaleX)
  const height = Math.max(0, bounds.height - topInset - (number(style.borderBottomWidth) + number(style.paddingBottom)) * scaleY)
  const fit = Math.min(width / (element.naturalWidth * scaleX), height / (element.naturalHeight * scaleY), style.objectFit === 'scale-down' ? 1 : Infinity)
  const imageWidth = element.naturalWidth * scaleX * fit
  const imageHeight = element.naturalHeight * scaleY * fit
  const position = style.objectPosition.split(' ')
  const offset = (value: string, space: number, scale: number) => value.endsWith('%') ? space * number(value) / 100 : value === 'center' ? space / 2 : value === 'right' || value === 'bottom' ? space : value === 'left' || value === 'top' ? 0 : number(value) * scale
  const left = bounds.left + leftInset + offset(position[0] ?? '50%', width - imageWidth, scaleX)
  const top = bounds.top + topInset + offset(position[1] ?? '50%', height - imageHeight, scaleY)
  return new DOMRect(left, top, imageWidth, imageHeight)
}
