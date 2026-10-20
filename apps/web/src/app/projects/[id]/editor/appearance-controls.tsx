'use client'

import { useState } from 'react'
import { PanelOptions } from './panel-options'
import { SizeSlider } from './size-slider'
import { ColorInput } from './color-input'

type Appearance = Record<string, unknown>
export function AppearanceControls({ value, element, onChange, compact = false }: { compact?: boolean; value: Appearance; element?: HTMLElement; onChange: (patch: Appearance) => void }) {
  const [setting, setSetting] = useState('corners')
  const computed = element ? getComputedStyle(element) : undefined
  const radius = Number(value.borderRadius ?? (parseFloat(computed?.borderRadius ?? '') || 0))
  const width = Number(value.borderWidth ?? (parseFloat(computed?.borderWidth ?? '') || 0))
  const borderStyle = String(value.borderStyle ?? computed?.borderStyle ?? 'none')
  const changeBorder = (patch: Appearance) => onChange({ borderColor: String(value.borderColor ?? '#262333'), borderStyle: borderStyle === 'none' ? 'solid' : borderStyle, borderWidth: width || 1, ...patch })
  const shadow = String(value.shadow ?? 'original')
  const shadowDistance = Number(value.shadowDistance ?? ({ soft: 2, medium: 8, strong: 16 }[shadow] ?? 2))
  const changeShadow = (patch: Appearance) => onChange({ shadow: shadow === 'original' || shadow === 'none' ? 'soft' : shadow, ...patch })
  return <div className={compact ? "grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]" : "grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]"}>
    <PanelOptions className={compact ? "sticky top-16 self-start" : undefined} label="Appearance" options={[{ value: 'corners', label: 'Rounded corners' }, { value: 'border', label: 'Border' }, { value: 'shadow', label: 'Shadow' }]} value={setting} onChange={next => { setSetting(next); if (compact) document.getElementById('editor-left-panel')?.scrollTo({ top: 0, behavior: 'instant' }) }} />
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
      {setting === 'corners' && <div className="grid gap-3"><label><SizeSlider label="Corner radius" value={radius} min={0} max={200} unit="px" onChange={borderRadius => onChange({ borderRadius })} /></label><button type="button" className="justify-self-start text-xs text-violet-700 underline" onClick={() => onChange({ borderRadius: 0 })}>Square corners</button></div>}
      {setting === 'border' && <div className={compact ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
        <label><SizeSlider label="Border width" value={width} min={0} max={20} unit="px" onChange={borderWidth => changeBorder({ borderWidth })} /></label>
        <label className="grid content-start gap-2 text-sm">Border style<select aria-label="Border style" className="min-w-0 w-full rounded-lg border border-neutral-200 bg-white p-2" value={borderStyle} onChange={event => changeBorder({ borderStyle: event.target.value })}><option value="none">None</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
        <div className="col-span-full"><ColorInput label="Border colour" value={String(value.borderColor ?? '#262333')} onChange={borderColor => changeBorder({ borderColor })} /></div>
      </div>}
      {setting === 'shadow' && <div className={compact ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}><PanelOptions label="Shadow strength" options={[{ value: 'original', label: 'Original' }, { value: 'none', label: 'None' }, { value: 'soft', label: 'Soft' }, { value: 'medium', label: 'Medium' }, { value: 'strong', label: 'Strong' }]} value={shadow} onChange={shadow => onChange({ shadow: shadow === 'original' ? undefined : shadow })} /><div className="grid content-start gap-4"><label className="grid gap-2 text-sm">Shadow effect<select aria-label="Shadow effect" className="min-w-0 w-full rounded-lg border border-neutral-200 bg-white p-2" value={String(value.shadowMode ?? 'directional')} onChange={event => changeShadow({ shadowMode: event.target.value })}><option value="directional">Directional shadow</option><option value="raised">All-around / raised</option></select></label><ColorInput label="Shadow colour" value={String(value.shadowColor ?? '#000000')} onChange={shadowColor => changeShadow({ shadowColor })} /><label><SizeSlider label="Shadow distance" value={shadowDistance} min={0} max={100} unit="px" onChange={shadowDistance => changeShadow({ shadowDistance })} /></label>{value.shadowMode !== 'raised' && <label><SizeSlider label="Shadow direction" value={Number(value.shadowAngle ?? 90)} min={0} max={360} unit="°" onChange={shadowAngle => changeShadow({ shadowAngle })} /></label>}<label><SizeSlider label="Shadow softness" value={Number(value.shadowBlur ?? ({ soft: 8, medium: 24, strong: 40 }[shadow] ?? 8))} min={0} max={100} unit="px" onChange={shadowBlur => changeShadow({ shadowBlur })} /></label><label><SizeSlider label="Shadow opacity" value={Number(value.shadowOpacity ?? ({ soft: 12, medium: 18, strong: 28 }[shadow] ?? 12))} min={0} max={100} unit="%" onChange={shadowOpacity => changeShadow({ shadowOpacity })} /></label></div></div>}
    </div>
  </div>
}
