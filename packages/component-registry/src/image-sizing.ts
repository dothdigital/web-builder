import type { CSSProperties } from 'react'
import { z } from 'zod'
export const imageSizesSchema = z.record(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/), z.object({
  width: z.number().min(10).max(100).optional(),
  height: z.number().min(40).max(1600).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  position: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
})).default({})
export function imageSizing(props: unknown, path: string, background = false): CSSProperties {
  const value = (props as { imageSizes?: z.infer<typeof imageSizesSchema> }).imageSizes?.[path]
  if (!value) return {}
  return {
    ...(!background && (value.width !== undefined || value.height !== undefined) ? { '--awb-desktop-geometry': 1 } as CSSProperties : {}),
    ...(value.fit ? { objectFit: value.fit } : {}),
    ...(value.position ? { objectPosition: value.position } : {}),
    ...(!background && value.width !== undefined ? { width: `${value.width}%`, minWidth: 0, maxWidth: '100%' } : {}),
    ...(!background && value.height !== undefined ? { height: `${value.height}px`, minHeight: 0, maxHeight: 'none', aspectRatio: 'auto' } : {}),
  }
}
