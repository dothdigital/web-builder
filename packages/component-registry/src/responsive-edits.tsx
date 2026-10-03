import type { CSSProperties, ReactNode } from 'react'

// Desktop placement uses measured pixels. At phone/tablet widths, reserve
// space through normal flow instead of replaying those pixels over the copy.
export function ResponsiveEdits({ children, background }: { children: ReactNode; background?: string }) {
  return <div data-awb-responsive-edits="true" style={{ containerType: 'inline-size', containerName: 'awb-edit-surface', minWidth: 0, width: '100%', '--awb-mobile-section-background': background ?? 'var(--awb-bg)' } as CSSProperties}>
    <style>{`@container awb-edit-surface (max-width:767px){
      [data-awb-responsive-edits] [style*="--awb-desktop-geometry"]{translate:none!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;box-sizing:border-box;overflow-wrap:anywhere}
      [data-awb-responsive-edits] [data-awb-width-slot]{height:auto!important;min-height:0!important}
      [data-awb-responsive-edits] img[style*="--awb-desktop-geometry"]{aspect-ratio:auto!important}
      [data-awb-responsive-edits] [data-awb-flow-slot]{display:none!important}
      [data-awb-responsive-edits] [data-awb-free-layout]{display:flex;flex-direction:column;gap:1.5rem;background:var(--awb-mobile-section-background)}
      [data-awb-responsive-edits] [data-awb-free-base]{min-height:0!important}
      [data-awb-responsive-edits] [data-awb-free-item]{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:auto!important;min-height:0!important;max-width:100%;padding-inline:1.5rem}
      [data-awb-responsive-edits] [data-awb-free-item]>:not(style){width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;transform:none!important;translate:none!important}
      [data-awb-responsive-edits] [data-awb-free-item]>[data-awb-image-container]>img,[data-awb-responsive-edits] [data-awb-free-item]>img{width:100%!important;height:auto!important;max-height:none;aspect-ratio:auto!important}
    }`}</style>
    {children}
  </div>
}

export function hasLayoutEdits(props: Record<string, unknown>): boolean {
  return !!(Object.keys(props.elementOffsets ?? {}).length || Object.keys(props.imageSizes ?? {}).length || (props.freeElements as unknown[] | undefined)?.length || Object.values((props.elementColors ?? {}) as Record<string, Record<string, unknown>>).some((style) => style.width !== undefined || style.height !== undefined || style.layoutColumns !== undefined))
}
