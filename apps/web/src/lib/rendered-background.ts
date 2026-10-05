export function renderedBackgroundColor(element: HTMLElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return '#ffffff'
  let current: HTMLElement | null = element
  while (current) {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = getComputedStyle(current).backgroundColor
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    if (alpha) return '#' + [red!, green!, blue!].map(channel => channel.toString(16).padStart(2, '0')).join('')
    current = current.parentElement
  }
  return '#ffffff'
}
