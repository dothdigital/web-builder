import type { CSSProperties, ReactNode } from 'react'
import { imageSizing, imageSizesSchema } from './image-sizing'
import { z } from 'zod'
import type { EditorField } from './types'

export const sectionBackgroundSchema = z.object({
  imageSizes: imageSizesSchema,
  sectionBackgroundMode: z.enum(['original', 'colour', 'image']).default('original'),
  sectionBackgroundImageUrl: z.string().default(''),
  sectionBackgroundTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#102a43'),
  sectionBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  sectionBackgroundOpacity: z.number().min(0).max(100).default(85),
  sectionBackgroundImageOpacity: z.number().min(0).max(100).default(100),
  sectionBackgroundPosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
  sectionBackgroundBlend: z.enum(['normal', 'multiply', 'screen', 'overlay', 'luminosity']).default('normal'),
  sectionBackgroundTreatment: z.enum(['solid', 'gradient']).default('solid'),
})

export const sectionBackgroundFields: EditorField[] = [
  { path: '/sectionBackgroundMode', label: 'Section background', type: 'select', options: ['original', 'colour', 'image'] },
  { path: '/sectionBackgroundImageUrl', label: 'Section background image', type: 'image' },
  { path: '/sectionBackgroundColor', label: 'Section background / overlay colour', type: 'color' },
  { path: '/sectionBackgroundTextColor', label: 'Section text colour', type: 'color' },
  { path: '/sectionBackgroundOpacity', label: 'Section overlay opacity (%)', type: 'range', min: 0, max: 100, step: 1 },
  { path: '/sectionBackgroundImageOpacity', label: 'Section image opacity (%)', type: 'range', min: 0, max: 100, step: 1 },
  { path: '/sectionBackgroundPosition', label: 'Section background position', type: 'select', options: ['center', 'top', 'bottom', 'left', 'right'] },
  { path: '/sectionBackgroundBlend', label: 'Section background blend', type: 'select', options: ['normal', 'multiply', 'screen', 'overlay', 'luminosity'] },
  { path: '/sectionBackgroundTreatment', label: 'Section overlay treatment', type: 'select', options: ['solid', 'gradient'] },
]

export function SectionBackground({ props, children }: { props: z.infer<typeof sectionBackgroundSchema>; children: ReactNode }) {
  if (props.sectionBackgroundMode === 'original') return <>{children}</>
  const hasImage = props.sectionBackgroundMode === 'image' && Boolean(props.sectionBackgroundImageUrl)
  const overlay = props.sectionBackgroundTreatment === 'gradient'
    ? `linear-gradient(to right, ${props.sectionBackgroundColor} 15%, transparent 130%)`
    : props.sectionBackgroundColor
  return <div className="awb-section-background" style={{ position: 'relative', isolation: 'isolate', background: props.sectionBackgroundColor, color: props.sectionBackgroundTextColor, '--awb-fg': props.sectionBackgroundTextColor, '--awb-muted': props.sectionBackgroundTextColor } as CSSProperties}>
    <style>{'.awb-section-background > .awb-section-content > :first-child{background:transparent!important;color:inherit!important;isolation:auto!important}.awb-section-background .awb-native-background{display:none!important}'}</style>
    {hasImage && <img alt="" aria-hidden="true" src={props.sectionBackgroundImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: props.sectionBackgroundPosition, opacity: props.sectionBackgroundImageOpacity / 100, mixBlendMode: props.sectionBackgroundBlend, zIndex: -2, pointerEvents: 'none', ...imageSizing(props, '/sectionBackgroundImageUrl', true) }} />}
    {hasImage && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlay, opacity: props.sectionBackgroundOpacity / 100, zIndex: -1, pointerEvents: 'none' }} />}
    <div className="awb-section-content">{children}</div>
  </div>
}
