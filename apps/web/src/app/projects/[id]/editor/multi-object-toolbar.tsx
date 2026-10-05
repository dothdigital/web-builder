'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { alignSelection, type Alignment, type ElementGroup, type MultiAction } from '@/lib/multi-object-editing'
import { objectScope } from '@/lib/object-editing'
import { SelectedObjectInteraction, type MovePointer } from './selected-object-interaction'
import { SelectionResize } from './selection-resize'
import { SpacingControls } from './spacing-controls'
import { ColorInput } from './color-input'

export function MultiObjectToolbar({ node, paths, props, onAction, onClear }: { node: HTMLElement | null; paths: string[]; props: Record<string, unknown>; onAction: (action: MultiAction) => void; onClear: () => void }) {
  const [panel, setPanel] = useState<'spacing' | 'border' | 'size'>()
  const [elements, setElements] = useState<HTMLElement[]>([])
  const [position, setPosition] = useState({ top: 80, left: 8 })
  const toolbar = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; latestX: number; latestY: number; sectionTop: number; sectionLeft: number; raf: number; ghost: HTMLDivElement } | null>(null)
  const cancel = () => { if (drag.current) { cancelAnimationFrame(drag.current.raf); drag.current.ghost.remove() }; drag.current = null }
  useEffect(() => {
    if (!node) return
    const all = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]'))
    const selected = all.filter((element) => paths.includes(element.dataset.awbElement!))
    const roots = selected.filter((element) => !selected.some((other) => other !== element && other.contains(element)))
    const previous = roots.map((element) => ({ element, outline: element.style.outline, offset: element.style.outlineOffset }))
    roots.forEach((element) => { element.style.outline = '2px solid #0284c7'; element.style.outlineOffset = '3px' })
    const measure = () => {
      const boxes = roots.map((element) => element.getBoundingClientRect())
      if (!boxes.length) return
      setElements(roots)
      setPosition({ top: Math.max(8, Math.min(...boxes.map((box) => box.top)) - (toolbar.current?.offsetHeight ?? 100) - 10), left: Math.max(8, Math.min(Math.min(...boxes.map((box) => box.left)), window.innerWidth - (toolbar.current?.offsetWidth ?? 550) - 8)) })
    }
    const raf = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    roots.forEach((element) => observer.observe(element))
    if (toolbar.current) observer.observe(toolbar.current)
    window.addEventListener('scroll', measure, true); window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); previous.forEach(({ element, outline, offset }) => { element.style.outline = outline; element.style.outlineOffset = offset }); cancel() }
  }, [node, paths, props])
  useLayoutEffect(() => {
    const bar = toolbar.current
    if (!bar || !elements.length) return
    const place = () => {
      const boxes = elements.map((element) => element.getBoundingClientRect())
      bar.style.top = `${Math.max(8, Math.min(...boxes.map((box) => box.top)) - bar.offsetHeight - 10)}px`
      bar.style.left = `${Math.max(8, Math.min(Math.min(...boxes.map((box) => box.left)), window.innerWidth - bar.offsetWidth - 8))}px`
    }
    place()
    const observer = new ResizeObserver(place); observer.observe(bar)
    return () => observer.disconnect()
  }, [elements, position])
  if (!node || !elements.length) return null
  const selectedPaths = elements.map((element) => element.dataset.awbElement!)
  const visuals = elements.map((element) => { const visual = element.hasAttribute('data-awb-free-item') ? element.querySelector<HTMLElement>('[data-awb-element]') ?? element : element; return visual.hasAttribute('data-awb-image-container') ? visual.querySelector<HTMLElement>('img,[role="img"]') ?? visual : visual })
  const imagesOnly = visuals.every((element) => element.matches('img,[role="img"]'))
  const textOnly = visuals.every((element) => element.matches('h1,h2,h3,h4,h5,h6,p,span,strong,em,blockquote,summary,a,button,input,textarea,select,legend,label'))
  const allSurfaces = visuals.every((element) => !element.matches('img,[role="img"]'))
  const appearance = (path: string) => { const scope = objectScope(props, path); return (scope.props.elementColors as Record<string, Record<string, unknown>> | undefined)?.[scope.path] ?? {} }
  const common = (key: string) => {
    const values = selectedPaths.map((path, i) => {
      const value = appearance(path)[key] ?? getComputedStyle(visuals[i]!)[key as 'color']
      if (['color', 'backgroundColor', 'borderColor'].includes(key)) return rgbHex(String(value))
      if (['fontSize', 'borderWidth', 'borderRadius', 'height'].includes(key)) return parseFloat(String(value))
      return String(value)
    })
    return values.every((value) => value === values[0]) ? values[0] : undefined
  }
  const style = (value: Record<string, unknown>) => onAction({ type: 'style', paths: selectedPaths, value })
  const group = ((props.elementGroups ?? []) as ElementGroup[]).find((entry) => entry.paths.length === selectedPaths.length && entry.paths.every((path) => selectedPaths.includes(path)))
  const move = (dx: number, dy: number) => {
    const section = node.getBoundingClientRect()
    const boxes = elements.map((element) => element.getBoundingClientRect())
    // Clamp the selection as a whole, maintaining distances between members.
    const minX = Math.min(...boxes.map((box) => box.left - section.left)), maxX = Math.max(...boxes.map((box) => box.right - section.left))
    const minY = Math.min(...boxes.map((box) => box.top - section.top))
    dx = Math.max(-minX, Math.min(section.width - maxX, dx)); dy = Math.max(-minY, dy)
    onAction({ type: 'move', items: elements.map((element, i) => { const box = boxes[i]!; return { path: element.dataset.awbElement!, placement: { x: (box.left - section.left + dx) / Math.max(1, section.width) * 100, y: box.top - section.top + dy, width: box.width / Math.max(1, section.width) * 100, height: box.height }, offset: { x: dx, y: dy, sectionWidth: section.width } } }) })
  }
  const align = (alignment: Alignment) => {
    const section = node.getBoundingClientRect()
    const boxes = elements.map((element) => { const box = element.getBoundingClientRect(); return { path: element.dataset.awbElement!, x: box.left - section.left, y: box.top - section.top, width: box.width, height: box.height } })
    const arranged = alignSelection(boxes, alignment)
    onAction({ type: 'move', items: arranged.map((box, i) => ({ path: box.path, placement: { x: box.x / section.width * 100, y: box.y, width: box.width / section.width * 100, height: box.height }, offset: { x: box.x - boxes[i]!.x, y: box.y - boxes[i]!.y, sectionWidth: section.width } })) })
  }
  const start = (event: MovePointer) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
    const boxes = elements.map((element) => element.getBoundingClientRect()), section = node.getBoundingClientRect()
    const left = Math.min(...boxes.map((box) => box.left)), top = Math.min(...boxes.map((box) => box.top))
    const ghost = document.createElement('div')
    Object.assign(ghost.style, { position: 'fixed', pointerEvents: 'none', zIndex: '10000', border: '2px dashed #0284c7', background: 'rgba(14,165,233,.08)', left: `${left}px`, top: `${top}px`, width: `${Math.max(...boxes.map((box) => box.right)) - left}px`, height: `${Math.max(...boxes.map((box) => box.bottom)) - top}px` })
    document.body.appendChild(ghost)
    drag.current = { x: event.clientX, y: event.clientY, latestX: event.clientX, latestY: event.clientY, sectionTop: section.top, sectionLeft: section.left, ghost, raf: 0 }
    const tick = () => {
      const current = drag.current
      if (!current) return
      const scroller = node.closest<HTMLElement>('[data-awb-canvas-scroll]')
      if (scroller && Math.abs(current.latestY - current.y) > 8) {
        const rect = scroller.getBoundingClientRect()
        if (current.latestY < rect.top + 48 && current.latestY < current.y) scroller.scrollTop -= 12
        else if (current.latestY > rect.bottom - 48 && current.latestY > current.y) scroller.scrollTop += 12
      }
      current.raf = requestAnimationFrame(tick)
    }
    drag.current.raf = requestAnimationFrame(tick)
  }
  const finish = () => { const current = drag.current; if (!current) return; const section = node.getBoundingClientRect(); const dx = current.latestX - current.x + current.sectionLeft - section.left, dy = current.latestY - current.y + current.sectionTop - section.top; cancel(); if (Math.abs(dx) + Math.abs(dy) > 3) move(dx, dy) }
  const button = 'rounded border border-neutral-200 px-2 py-1.5 hover:bg-sky-50'
  return createPortal(<><SelectionResize elements={elements} section={node} props={props} onAction={onAction} /><div ref={toolbar} role="toolbar" aria-label="Multiple object controls" className="fixed z-[1000] max-w-[calc(100vw-16px)] rounded-lg border border-sky-200 bg-white p-2 text-xs text-neutral-900 shadow-xl" style={{ ...position, fontFamily: 'Arial, sans-serif' }} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
    {elements.map((element) => <SelectedObjectInteraction key={element.dataset.awbElement} element={element} onStart={start} onMove={(x, y) => { const current = drag.current; if (current) { current.latestX = x; current.latestY = y; current.ghost.style.translate = `${x - current.x}px ${y - current.y}px` } }} onFinish={finish} onCancel={cancel} onNudge={move} />)}
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="px-1 font-semibold">{elements.length} selected{group ? ' · Group' : ''}</span>
      <button type="button" className={button} onClick={() => onAction({ type: group ? 'ungroup' : 'group', paths: selectedPaths })}>{group ? 'Ungroup' : 'Group'}</button>
      {imagesOnly && <select aria-label="Selected images fit" className={button} defaultValue="" onChange={(event) => onAction({ type: 'imageSize', paths: visuals.map((element) => element.dataset.awbElement!), value: { fit: event.target.value } })}><option value="">Image fit…</option><option value="cover">Fill / crop</option><option value="contain">Fit whole image</option></select>}
      {textOnly && <>
        <select aria-label="Selected objects font" className={button} value={String(common('fontFamily') ?? '')} onChange={(event) => style({ fontFamily: event.target.value })}><option value={String(common('fontFamily') ?? '')}>{common('fontFamily') ? String(common('fontFamily')).split(',')[0] : 'Mixed fonts'}</option>{['Arial, sans-serif', 'Verdana, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'system-ui, sans-serif'].map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}</select>
        <input key={`${selectedPaths.join(',')}-${String(common('fontSize'))}`} aria-label="Selected objects font size" placeholder="Mixed" type="number" min={10} max={160} defaultValue={common('fontSize') === undefined ? '' : parseFloat(String(common('fontSize')))} className="w-16 rounded border p-1.5" onBlur={(event) => { if (event.target.value) style({ fontSize: Math.max(10, Math.min(160, Number(event.target.value))) }) }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
        <button type="button" className={`${button} font-bold`} aria-pressed={String(common('fontWeight')) === '700'} onClick={() => style({ fontWeight: String(common('fontWeight')) === '700' ? 400 : 700 })}>B</button>
        <button type="button" className={`${button} italic`} aria-pressed={common('fontStyle') === 'italic'} onClick={() => style({ fontStyle: common('fontStyle') === 'italic' ? 'normal' : 'italic' })}>I</button>
        <select aria-label="Selected objects text alignment" className={button} value={String(common('textAlign') ?? '')} onChange={(event) => style({ textAlign: event.target.value })}><option value="">Mixed / default</option>{['left', 'center', 'right', 'justify'].map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </>}
      <button type="button" className={`${button} text-red-700`} onClick={() => onAction({ type: 'delete', paths: selectedPaths })}>Delete selected</button>
      <button type="button" className={button} aria-expanded={panel === 'spacing'} onClick={() => setPanel(panel === 'spacing' ? undefined : 'spacing')}>Spacing</button>
      {allSurfaces && <><button type="button" className={button} aria-expanded={panel === 'border'} onClick={() => setPanel(panel === 'border' ? undefined : 'border')}>Borders</button><button type="button" className={button} aria-expanded={panel === 'size'} onClick={() => setPanel(panel === 'size' ? undefined : 'size')}>Size</button></>}
      <button type="button" className={button} onClick={onClear}>Deselect</button>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
      <select aria-label="Align selected objects" className={button} value="" onChange={(event) => { if (event.target.value) align(event.target.value as Alignment) }}><option value="">Align objects…</option><option value="left">Left edges</option><option value="center">Horizontal centres</option><option value="right">Right edges</option><option value="top">Top edges</option><option value="middle">Vertical centres</option><option value="bottom">Bottom edges</option></select>
      <button type="button" className={button} onClick={() => align('horizontal')}>Equal horizontal gaps</button>
      <button type="button" className={button} onClick={() => align('vertical')}>Equal vertical gaps</button>
    </div>
    <div className="mt-2 flex flex-wrap gap-3">
      {allSurfaces && <div className="w-52"><span>Text colour{common('color') === undefined ? ' · Mixed' : ''}</span><ColorInput label="Selected text colour" value={rgbHex(String(common('color') ?? '#000000'))} onChange={(color) => style({ color })} /></div>}
      {allSurfaces && <div className="w-52"><span>BG fill{common('backgroundColor') === undefined ? ' · Mixed' : ''}</span><ColorInput label="Selected background fill" value={rgbHex(String(common('backgroundColor') ?? 'transparent'))} onChange={(backgroundColor) => style({ backgroundColor })} /></div>}
    </div>
    {panel === 'spacing' && <div className="mt-2 max-h-[40vh] overflow-auto border-t pt-2"><SpacingControls elements={elements} appearances={selectedPaths.map(appearance)} onChange={style} /></div>}
    {panel === 'border' && <div className="mt-2 grid max-h-[40vh] gap-3 overflow-auto border-t pt-2">
      <ColorInput label="Selected border colour" value={String(common('borderColor') ?? '#000000')} onChange={borderColor => style({ borderColor })} />
      <SelectionNumber label="Selected border width" value={common('borderWidth')} min={0} max={20} onChange={borderWidth => style({ borderWidth })} />
      <label className="grid gap-1">Border style<select aria-label="Selected border style" className="rounded border p-1.5" value={String(common('borderStyle') ?? '')} onChange={event => { if (event.target.value) style({ borderStyle: event.target.value }) }}><option value="">Mixed</option><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="none">None</option></select></label>
      <SelectionNumber label="Selected corner radius" value={common('borderRadius')} min={0} max={200} onChange={borderRadius => style({ borderRadius })} />
    </div>}
    {panel === 'size' && <div className="mt-2 grid max-h-[40vh] gap-3 overflow-auto border-t pt-2">
      <SelectionNumber label="Selected width (%)" value={selectedPaths.every(path => appearance(path).width === appearance(selectedPaths[0]!).width) ? appearance(selectedPaths[0]!).width : undefined} min={10} max={100} onChange={width => style({ width })} />
      <SelectionNumber label="Selected height (px)" value={common('height')} min={24} max={3000} onChange={height => style({ height })} />
    </div>}
    <p className="mt-2 text-neutral-500">Shift-click or Select area · Drag to move all · Corner handles scale all proportionally · Arrows: 1px · Shift + arrows: 10px</p>
  </div></>, document.body)
}

function SelectionNumber({ label, value, min, max, onChange }: { label: string; value: unknown; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1">{label}<input key={String(value)} aria-label={label} className="w-28 rounded border p-1.5" type="number" min={min} max={max} placeholder="Mixed / automatic" defaultValue={value === undefined ? '' : Number(value)} onBlur={event => { if (event.target.value && Number.isFinite(Number(event.target.value))) onChange(Math.max(min, Math.min(max, Number(event.target.value)))) }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} /></label>
}

function rgbHex(value: string) {
  if (value.startsWith('#') || value === 'transparent') return value
  const parts = value.match(/[\d.]+/g)?.map(Number)
  if (!parts || parts.length < 3) return '#000000'
  if (parts[3] === 0) return 'transparent'
  return '#' + parts.slice(0, 3).map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')
}
