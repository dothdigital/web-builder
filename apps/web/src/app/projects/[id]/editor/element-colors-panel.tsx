'use client'

import { ColorInput } from './color-input'
import { useEffect, useState } from 'react'
import { colorTargets } from '@awb/component-registry'

type Colors = { verticalAlign?: 'top' | 'middle' | 'bottom'; textAlign?: 'left' | 'center' | 'right' | 'justify'; fontStyle?: 'normal' | 'italic'; fontFamily?: string; fontWeight?: number; width?: number; height?: number; fontSize?: number; color?: string; backgroundColor?: string; borderColor?: string; borderWidth?: number; borderRadius?: number; borderStyle?: string }
export function ElementColorsPanel({ renderedPathPrefix = '', componentId, props, onChange, selectedPath, onSelect, buttonPanel = false }: { renderedPathPrefix?: string; buttonPanel?: boolean; selectedPath?: string; onSelect?: (path: string) => void; componentId: string; props: Record<string, unknown>; onChange: (path: string, value: unknown) => void }) {
  const targets = colorTargets(componentId, props)
  if (selectedPath?.startsWith('/layout/')) targets.push({ path: selectedPath, label: 'Layout box', surface: true })
  const [selected, setSelected] = useState('')
  const appearancePath = (componentId === 'ContactSplit' && selectedPath === '/submitLabel' ? '/submitButton' : selectedPath)?.replace(/^(\/extraElements\/\d+)\/[^/]+$/, '$1').replace(/^(\/(?:cta|primaryCta|secondaryCta))\/(?:label|href)$/, '$1')
  const target = targets.find((item) => item.path === (appearancePath ?? selected)) ?? (selectedPath ? undefined : targets[0])
  const [rendered, setRendered] = useState<Record<string, string>>({})
  const targetPath = target?.path
  useEffect(() => {
    const frame = document.querySelector('[data-awb-selected-frame="true"]')
    const element = Array.from(frame?.querySelectorAll<HTMLElement>('[data-awb-element]') ?? []).find((entry) => entry.dataset.awbElement === `${renderedPathPrefix}${targetPath}`)
    if (!element) { const reset = requestAnimationFrame(() => setRendered({})); return () => cancelAnimationFrame(reset) }
    const measure = () => {
      const computed = getComputedStyle(element)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      const hex = (value: string) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data
        return alpha === 0 ? 'transparent' : '#' + [r!, g!, b!].map((channel) => channel.toString(16).padStart(2, '0')).join('')
      }
      setRendered({ verticalAlign: (computed.flexDirection === 'column' ? computed.justifyContent : computed.alignItems) === 'center' ? 'middle' : (computed.flexDirection === 'column' ? computed.justifyContent : computed.alignItems) === 'flex-end' ? 'bottom' : 'top', textAlign: computed.textAlign, fontFamily: computed.fontFamily, fontSize: computed.fontSize, fontWeight: computed.fontWeight, fontStyle: computed.fontStyle, color: hex(computed.color), backgroundColor: hex(computed.backgroundColor), borderColor: computed.borderStyle === 'none' ? 'transparent' : hex(computed.borderColor) })
    }
    const initial = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    // Theme changes and inherited colours can change without changing section props.
    const observer = new MutationObserver(measure)
    let ancestor: HTMLElement | null = element
    while (ancestor) { observer.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class'] }); ancestor = ancestor.parentElement }
    return () => { cancelAnimationFrame(initial); window.removeEventListener('resize', measure); observer.disconnect() }
  }, [targetPath, props, componentId, renderedPathPrefix])
  if (!target) return null
  const colors = (props.elementColors ?? {}) as Record<string, Colors>
  const current = colors[target.path] ?? {}
  const fontSize = current.fontSize ?? (parseFloat(rendered.fontSize ?? '') || undefined)
  const inheritedStyle = rendered.fontWeight ? `${rendered.fontStyle === 'italic' ? 'Italic' : 'Normal'} · weight ${rendered.fontWeight}` : 'Theme default'
  const isButton = /^\/(cta|primaryCta|secondaryCta|submitButton)$/.test(target.path) || (/^\/extraElements\/\d+$/.test(target.path) && (props.extraElements as Array<{ kind: string }> | undefined)?.[Number(target.path.split('/')[2])]?.kind === 'button')
  const update = (key: keyof Colors, value: string | number) => onChange('/elementColors', { ...colors, [target.path]: { ...current, [key]: value } })
  return <fieldset className="m-4 grid gap-3 rounded-lg border border-neutral-200 p-3">
    <legend className="px-1 text-sm font-semibold">{buttonPanel ? `${target.label} appearance` : 'Element appearance'}</legend>
    {!buttonPanel && <p className="text-xs text-neutral-500">Choose the text, card or chip to change. Other elements keep their colours.</p>}
    {!buttonPanel && <label className="grid gap-1 text-xs">Element<select className="min-w-0 w-full rounded border border-neutral-300 p-2" value={target.path} onChange={(event) => { setSelected(event.target.value); onSelect?.(event.target.value) }}>{targets.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}</select></label>}
    {(['color', 'backgroundColor', 'borderColor'] as Array<'color' | 'backgroundColor' | 'borderColor'>).map((key) => <div key={key} className="grid gap-2 text-xs"><span>{key === 'color' ? 'Font colour' : key === 'backgroundColor' ? (isButton ? 'Button background colour' : 'Background colour') : 'Border colour'}{!current[key] && <span className="block text-[10px] text-neutral-500">Using existing colour</span>}</span><ColorInput label={`${target.label} ${key === 'backgroundColor' ? 'background colour' : key === 'color' ? 'text colour' : 'border colour'}`} value={current[key] ?? rendered[key] ?? (key === 'backgroundColor' ? '#ffffff' : '#182225')} onChange={(value) => update(key, value)} /></div>)}
    {target.surface && <>
      <label className="grid gap-1 text-xs">Border width (px)<input aria-label="Border width" type="number" min={0} max={20} className="rounded border p-2" value={current.borderWidth ?? ''} placeholder="Existing width" onChange={(event) => { const value = Number(event.target.value); if (event.target.value && value >= 0 && value <= 20) update('borderWidth', value) }} /></label>
      <label className="grid gap-1 text-xs">Border style<select aria-label="Border style" className="rounded border p-2" value={current.borderStyle ?? ''} onChange={(event) => { const next = { ...current }; if (event.target.value) next.borderStyle = event.target.value; else delete next.borderStyle; onChange('/elementColors', { ...colors, [target.path]: next }) }}><option value="">Existing style</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="none">None</option></select></label>
      <label className="grid gap-1 text-xs">Corner radius (px)<input aria-label="Corner radius" type="number" min={0} max={200} className="rounded border p-2" value={current.borderRadius ?? ''} placeholder="Existing radius" onChange={(event) => { const value = Number(event.target.value); if (event.target.value && value >= 0 && value <= 200) update('borderRadius', value) }} /></label>
    </>}
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs">Text alignment</legend>
      <div className="grid grid-cols-4 gap-1">
        {(['left', 'center', 'right', 'justify'] as const).map((alignment) => {
          const existing = current.textAlign ?? rendered.textAlign ?? 'left'
          const active = existing === alignment || existing === 'start' && alignment === 'left' || existing === 'end' && alignment === 'right'
          const label = alignment === 'center' ? 'Centre' : alignment === 'justify' ? 'Justify' : alignment === 'left' ? 'Left' : 'Right'
          return <button key={alignment} type="button" aria-label={`Align text ${alignment}`} aria-pressed={active} className={`rounded border px-1 py-2 text-xs ${active ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-neutral-300 hover:bg-neutral-50'}`} onClick={() => update('textAlign', alignment)}>{label}</button>
        })}
      </div>
    </fieldset>
    {(!target.surface || isButton) && <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs">Vertical alignment</legend>
      <div className="grid grid-cols-3 gap-1">{(['top', 'middle', 'bottom'] as const).map((alignment) => {
        const active = (current.verticalAlign ?? rendered.verticalAlign ?? 'top') === alignment
        return <button key={alignment} type="button" aria-label={`Align text vertically ${alignment}`} aria-pressed={active} className={`rounded border px-1 py-2 text-xs capitalize ${active ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-neutral-300 hover:bg-neutral-50'}`} onClick={() => update('verticalAlign', alignment)}>{alignment}</button>
      })}</div>
      <p className="text-[10px] text-neutral-500">Positions the text inside its box. Use Size → Height to give it more space.</p>
    </fieldset>}
    <label className="grid gap-1 text-xs">Font family<select aria-label="Font family" className="w-full rounded border border-neutral-300 p-2" value={current.fontFamily ?? ''} onChange={(event) => { const next = { ...current }; if (event.target.value) next.fontFamily = event.target.value; else delete next.fontFamily; onChange('/elementColors', { ...colors, [target.path]: next }) }}>
      <option value="">{rendered.fontFamily ? `${rendered.fontFamily} (inherited)` : 'Theme default'}</option>
      {['Arial, sans-serif', 'Verdana, sans-serif', 'Tahoma, sans-serif', 'Trebuchet MS, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Courier New, monospace', 'system-ui, sans-serif'].map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}
      {current.fontFamily && !['Arial, sans-serif', 'Verdana, sans-serif', 'Tahoma, sans-serif', 'Trebuchet MS, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Courier New, monospace', 'system-ui, sans-serif'].includes(current.fontFamily) && <option value={current.fontFamily}>{current.fontFamily}</option>}
    </select></label>
    <label className="grid gap-1 text-xs">Font style<select aria-label="Font style" className="w-full rounded border border-neutral-300 p-2" value={current.fontWeight === undefined && current.fontStyle === undefined ? '' : current.fontWeight === 700 ? (current.fontStyle === 'italic' ? 'bold-italic' : 'bold') : current.fontStyle === 'italic' ? 'italic' : 'normal'} onChange={(event) => {
      const next = { ...current }
      const value = event.target.value
      if (!value) { delete next.fontWeight; delete next.fontStyle }
      else { next.fontWeight = value === 'bold' || value === 'bold-italic' ? 700 : 400; next.fontStyle = value === 'italic' || value === 'bold-italic' ? 'italic' : 'normal' }
      onChange('/elementColors', { ...colors, [target.path]: next })
    }}><option value="">{inheritedStyle} (inherited)</option><option value="normal">Normal</option><option value="bold">Bold</option><option value="italic">Italic</option><option value="bold-italic">Bold Italic</option></select></label>
    <label className="grid gap-1 text-xs">Font size {fontSize ? `(${Math.round(fontSize * 10) / 10}px${current.fontSize === undefined ? ', inherited' : ''})` : '(using existing size)'}<input type="range" min={10} max={160} value={fontSize ?? 16} onChange={(event) => update('fontSize', Number(event.target.value))} /></label>
    {isButton && <>
      <label className="grid gap-1 text-xs">Button width {current.width ? `(${current.width}%)` : '(automatic)'}<input aria-label="Button width" type="range" min={10} max={100} value={current.width ?? 30} onChange={(event) => update('width', Number(event.target.value))} /></label>
      <label className="grid gap-1 text-xs">Button height {current.height ? `(${current.height}px)` : '(automatic)'}<input aria-label="Button height" type="range" min={24} max={400} value={current.height ?? 48} onChange={(event) => update('height', Number(event.target.value))} /></label>
      <p className="text-xs text-neutral-500">Edit the button label and link below. Drag side handles for width, top or bottom for height, and corners for font size. Height accommodates the text.</p>
    </>}
    <button type="button" disabled={!colors[target.path]} className="text-left text-xs text-sky-700 underline disabled:opacity-40" onClick={() => { const next = { ...colors }; delete next[target.path]; onChange('/elementColors', next) }}>Reset this element’s appearance</button>
  </fieldset>
}
