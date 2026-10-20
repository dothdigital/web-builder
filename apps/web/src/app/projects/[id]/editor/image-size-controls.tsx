'use client'
import { SizeSlider } from './size-slider'
type Size = { width?: number; height?: number; fit?: 'cover' | 'contain'; position?: 'center' | 'top' | 'bottom' | 'left' | 'right' }
export function ImageSizeControls({ path, sizes, background, onChange }: { path: string; sizes: Record<string, Size>; background: boolean; onChange: (sizes: Record<string, Size>) => void }) {
  const value = sizes[path] ?? {}
  const update = (patch: Partial<Size>) => onChange({ ...sizes, [path]: { ...value, ...patch } })
  return <fieldset className="grid gap-2 rounded border border-neutral-200 p-2 text-xs">
    <legend className="px-1 font-medium">Image size & fit</legend>
    {!background && <>
      <label><SizeSlider label="Image width" min={10} max={100} value={value.width ?? 100} unit="%" onChange={width => update({ width })} /></label>
      <label><SizeSlider label="Image height" min={40} max={1600} value={value.height ?? 400} valueText={value.height === undefined ? 'Automatic' : undefined} unit="px" onChange={height => update({ height })} /></label>
      <span className="text-neutral-500">{value.height === undefined ? 'Height uses the layout default. Drag to set a custom height.' : <button type="button" className="underline" onClick={() => update({ height: undefined })}>Use automatic height</button>}</span>
    </>}
    {background && <p className="text-neutral-500">Background images fill the section. Use fit and position to control the crop.</p>}
    <label className="grid gap-1">Fit<select value={value.fit ?? 'cover'} className="rounded border border-neutral-300 p-1" onChange={(event) => update({ fit: event.target.value as Size['fit'] })}><option value="cover">Fill area (crop edges)</option><option value="contain">Show whole image</option></select></label>
    <label className="grid gap-1">Image focus (inside its frame)<select value={value.position ?? 'center'} className="rounded border border-neutral-300 p-1" onChange={(event) => update({ position: event.target.value as Size['position'] })}>{['center', 'top', 'bottom', 'left', 'right'].map((position) => <option key={position}>{position}</option>)}</select></label>
    <button type="button" className="text-left text-sky-700 underline" onClick={() => { const next = { ...sizes }; delete next[path]; onChange(next) }}>Reset image sizing</button>
  </fieldset>
}
