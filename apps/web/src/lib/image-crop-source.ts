export type SourceRect = { x: number; y: number; width: number; height: number }
// Map the frame's painted pixels back to the original image, including cover's
// hidden edges and non-centred image focus. Percent crop coordinates stay valid
// when the editor is zoomed or the viewport changes.
export function imageCropSource(width: number, height: number, frameWidth: number, frameHeight: number, fit: string, position = '50% 50%'): SourceRect {
  if (fit !== 'cover' && fit !== 'none') return { x: 0, y: 0, width, height }
  const scale = fit === 'none' ? 1 : Math.max(frameWidth / width, frameHeight / height)
  const parts = position.trim().split(/\s+/)
  const offset = (value: string, space: number) => value.endsWith('%') ? space * parseFloat(value) / 100 : value === 'left' || value === 'top' ? 0 : value === 'right' || value === 'bottom' ? space : value === 'center' ? space / 2 : parseFloat(value) || 0
  const x = Math.max(0, -offset(parts[0] ?? '50%', frameWidth - width * scale) / scale)
  const y = Math.max(0, -offset(parts[1] ?? '50%', frameHeight - height * scale) / scale)
  return { x, y, width: Math.min(width - x, frameWidth / scale), height: Math.min(height - y, frameHeight / scale) }
}
