'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { InlineLink, FlowSlot } from '@awb/component-registry'
import { imagePlacementAction } from '@/lib/image-placement'
import { objectScope, objectTextPointer, type LayerDirection, type ObjectAction, type Placement } from '@/lib/object-editing'
import { getAtPointer } from '@/lib/json-pointer'
import { SelectedObjectInteraction, type MovePointer } from './selected-object-interaction'
import { ImageField } from './inspector'
import { SpacingControls } from './spacing-controls'
import { ColorInput } from './color-input'
import { TextLinkControl } from './text-link-control'

type Target = { element: HTMLElement; parentPath?: string; kind: 'text' | 'image' | 'button' | 'block'; top: number; left: number; color: string; background: string; fontFamily: string; textAlign: string; verticalAlign: string; fontSize: number; bold: boolean; italic: boolean }
const fonts = ['Arial, sans-serif', 'Verdana, sans-serif', 'Tahoma, sans-serif', 'Trebuchet MS, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Courier New, monospace', 'system-ui, sans-serif']
function hex(value: string) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d'); if (!ctx) return '#000000'
  ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1)
  const data = ctx.getImageData(0, 0, 1, 1).data
  return data[3] === 0 ? 'transparent' : '#' + Array.from(data).slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
}
function flowSlot(element: HTMLElement): FlowSlot {
  const bounds = element.getBoundingClientRect(), style = getComputedStyle(element)
  const display = ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'list-item', 'inline'].includes(style.display) ? style.display as FlowSlot['display'] : 'block'
  return { width: Math.min(20000, bounds.width), height: Math.min(20000, bounds.height), display, marginTop: parseFloat(style.marginTop) || 0, marginRight: parseFloat(style.marginRight) || 0, marginBottom: parseFloat(style.marginBottom) || 0, marginLeft: parseFloat(style.marginLeft) || 0 }
}
function movementOffset(element: HTMLElement, frame: HTMLElement, next: Placement) {
  const bounds = element.getBoundingClientRect(), section = frame.getBoundingClientRect()
  return { sectionWidth: section.width, x: next.x / 100 * section.width - (bounds.left - section.left), y: next.y - (bounds.top - section.top) }
}
function placement(element: HTMLElement, frame: HTMLElement, dx = 0, dy = 0): Placement {
  const bounds = element.getBoundingClientRect(), section = frame.getBoundingClientRect()
  const width = Math.min(100, Math.max(10, bounds.width / Math.max(1, section.width) * 100))
  return { x: Math.max(0, Math.min(100 - width, (bounds.left + dx - section.left) / Math.max(1, section.width) * 100)), y: Math.max(0, Math.min(10000, bounds.top + dy - section.top)), width, height: Math.max(24, Math.min(3000, bounds.height)) }
}

function NumberControl({ value, min, max, label, onChange, className, live = false }: { value: number; min: number; max: number; label: string; onChange: (value: number) => void; className?: string; live?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  return <input aria-label={label} title={`${label}: ${min}–${max}`} type="number" min={min} max={max} className={className ?? 'ml-2 w-20 rounded border p-1'} value={draft ?? value} onChange={(event) => {
    const input = event.target.value
    setDraft(input)
    const next = Number(input)
    if (live && input.trim() && Number.isFinite(next) && next >= min && next <= max && next !== value) onChange(next)
  }} onBlur={() => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) {
      const next = Math.max(min, Math.min(max, Number(draft)))
      if (next !== value) onChange(next)
    }
    setDraft(null)
  }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } if (event.key === 'Escape') setDraft(null) }} />
}

export function ObjectToolbar({ node, path, props, projectId, imageUrls, sectionId, sections, onAction, onSelect }: {
  node: HTMLElement | null; path: string; props: Record<string, unknown>; projectId: string; imageUrls: Record<string, string>; sectionId?: string;
  sections: Array<{ id: string; label: string }>;
  onAction: (action: ObjectAction) => void; onSelect: (path?: string) => void;
}) {
  const [target, setTarget] = useState<Target>()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [panel, setPanel] = useState<'link' | 'spacing' | 'color' | 'background' | 'image' | 'content' | 'move' | 'size' | 'layout' | undefined>()
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; latestX: number; latestY: number; rect: DOMRect; sourceSlot: FlowSlot; ghost: HTMLDivElement; element: HTMLElement; opacity: string; frame?: HTMLElement; shadow?: string; raf: number } | null>(null)
  const cleanup = () => {
    const current = drag.current
    if (!current) return
    cancelAnimationFrame(current.raf); current.ghost.remove(); current.element.style.opacity = current.opacity
    if (current.frame) current.frame.style.boxShadow = current.shadow ?? ''
    drag.current = null
  }
  useLayoutEffect(() => {
    if (!node) return
    const element = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]')).find((entry) => entry.dataset.awbElement === path)
    if (!element) return
    const measure = () => {
      const bounds = element.getBoundingClientRect(), computed = getComputedStyle(element)
      if (!bounds.width || !bounds.height) { setTarget(undefined); return }
      const isFree = element.hasAttribute('data-awb-free-item')
      const visual = isFree ? element.querySelector<HTMLElement>('[data-awb-element]') ?? element : element
      const style = getComputedStyle(visual)
      const parent = element.parentElement?.closest<HTMLElement>('[data-awb-element]')
      setTarget({ element, parentPath: parent && node.contains(parent) ? parent.dataset.awbElement : undefined, kind: visual.matches('img,[role="img"]') ? 'image' : visual.matches('a,button') ? 'button' : (visual.hasAttribute('data-awb-menu') || visual.hasAttribute('data-awb-inline-text') || visual.matches('h1,h2,h3,h4,h5,h6,p,span,strong,em,blockquote,summary')) ? 'text' : 'block', top: bounds.top, left: bounds.left, color: hex(style.color), background: hex(style.backgroundColor), fontFamily: style.fontFamily, verticalAlign: (style.flexDirection === 'column' ? style.justifyContent : style.alignItems) === 'center' ? 'middle' : (style.flexDirection === 'column' ? style.justifyContent : style.alignItems) === 'flex-end' ? 'bottom' : 'top', textAlign: style.textAlign === 'start' ? 'left' : style.textAlign === 'end' ? 'right' : style.textAlign, fontSize: parseFloat(style.fontSize) || parseFloat(computed.fontSize), bold: Number(style.fontWeight) >= 600, italic: style.fontStyle === 'italic' })
    }
    measure()
    const resize = new ResizeObserver(measure); resize.observe(element); resize.observe(node)
    window.addEventListener('scroll', measure, true); window.addEventListener('resize', measure)
    return () => { resize.disconnect(); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); cleanup() }
  }, [node, path, props])
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar || !target) return
    const position = () => {
      const bounds = toolbar.getBoundingClientRect()
      // Use the complete toolbar height, including wrapped controls and open panels.
      toolbar.style.top = `${Math.max(8, Math.min(window.innerHeight - bounds.height - 8, target.top - bounds.height - 10))}px`
      toolbar.style.left = `${Math.max(8, Math.min(target.left, window.innerWidth - bounds.width - 8))}px`
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [target, panel])
  if (!target || !node) return null
  const scope = objectScope(props, path)
  const style = (scope.props.elementColors as Record<string, Record<string, unknown>> | undefined)?.[scope.path] ?? {}
  const textColor = String(style.color ?? target.color)
  const backgroundColor = String(style.backgroundColor ?? target.background)
  const textPointer = objectTextPointer(props, path)
  const textValue = textPointer ? getAtPointer(props, textPointer) : undefined
  const changeStyle = (value: Record<string, unknown>) => onAction({ type: 'style', value })
  const movementElement = target.element.parentElement?.hasAttribute('data-awb-image-container') ? target.element.parentElement : target.element
  const sourcePath = movementElement.dataset.awbElement ?? path
  const layerElement = movementElement.parentElement?.hasAttribute('data-awb-free-item') ? movementElement.parentElement : movementElement
  const layerPath = layerElement.dataset.awbElement ?? path
  const layoutElement = target.kind === 'image' ? movementElement.parentElement?.closest<HTMLElement>('[data-awb-element]') : target.kind === 'block' ? target.element : undefined
  const layoutPath = layoutElement?.dataset.awbElement
  const layoutScope = layoutPath ? objectScope(props, layoutPath) : undefined
  const layoutStyles = (layoutScope?.props.elementColors as Record<string, Record<string, unknown>> | undefined) ?? {}
  const layoutStyle = layoutScope ? layoutStyles[layoutScope.path] ?? {} : {}
  const changeLayout = (value: Record<string, unknown>) => {
    if (!layoutScope) return
    onAction({ type: 'content', pointer: `${layoutScope.prefix}/elementColors`, value: { ...layoutStyles, [layoutScope.path]: { ...layoutStyle, ...value } } })
  }
  const nudge = (x: number, y: number) => {
    if (!sectionId) return
    const next = placement(movementElement, node, x, y)
    onAction({ type: 'move', sourcePath, targetId: sectionId, sourceSlot: flowSlot(movementElement), placement: next, offset: movementOffset(movementElement, node, next) })
  }
  const startDrag = (event: MovePointer) => {
    if (!sectionId || event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); setPanel(undefined)
    const rect = movementElement.getBoundingClientRect()
    const ghost = document.createElement('div')
    Object.assign(ghost.style, { position: 'fixed', zIndex: '10000', pointerEvents: 'none', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, border: '2px dashed #0284c7', background: 'rgba(14,165,233,0.12)', borderRadius: '4px' })
    document.body.append(ghost)
    drag.current = { x: event.clientX, y: event.clientY, latestX: event.clientX, latestY: event.clientY, rect, sourceSlot: flowSlot(movementElement), ghost, element: movementElement, opacity: movementElement.style.opacity, raf: 0 }
    drag.current.element.style.opacity = '.35'; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true)
    const tick = () => {
      const current = drag.current; if (!current) return
      const dx = current.latestX - current.x, dy = current.latestY - current.y
      current.ghost.style.left = `${current.rect.left + dx}px`; current.ghost.style.top = `${current.rect.top + dy}px`
      const hit = document.elementFromPoint(current.latestX, current.latestY)?.closest<HTMLElement>('[data-awb-section-id]')
      if (hit !== current.frame) {
        if (current.frame) current.frame.style.boxShadow = current.shadow ?? ''
        current.frame = hit ?? undefined; current.shadow = hit?.style.boxShadow
        if (hit) hit.style.boxShadow = 'inset 0 0 0 3px #0284c7'
      }
      const scroll = node.closest<HTMLElement>('[data-awb-canvas-scroll]')
      if (scroll) { const bounds = scroll.getBoundingClientRect(); if (dy < -8 && current.latestY < bounds.top + 50) scroll.scrollTop -= 12; else if (dy > 8 && current.latestY > bounds.bottom - 50) scroll.scrollTop += 12 }
      current.raf = requestAnimationFrame(tick)
    }
    drag.current.raf = requestAnimationFrame(tick)
  }
  const finishDrag = () => {
    const current = drag.current; if (!current) return
    const hit = document.elementFromPoint(current.latestX, current.latestY)
    const scroll = node.closest('[data-awb-canvas-scroll]')
    const frame = hit?.closest<HTMLElement>('[data-awb-section-id]') ?? (scroll && hit && scroll.contains(hit) ? node.closest<HTMLElement>('[data-awb-section-id]') : undefined), targetId = frame?.dataset.awbSectionId
    const content = frame?.querySelector<HTMLElement>('[data-awb-section-content]')
    const moved = Math.hypot(current.latestX - current.x, current.latestY - current.y) > 4
    const rect = content?.getBoundingClientRect()
    const width = rect ? Math.max(10, Math.min(100, current.rect.width / rect.width * 100)) : 100
    const next = rect ? { x: Math.max(0, Math.min(100 - width, (current.rect.left + current.latestX - current.x - rect.left) / rect.width * 100)), y: Math.max(0, current.rect.top + current.latestY - current.y - rect.top), width, height: Math.max(24, Math.min(3000, current.rect.height)) } : undefined
    const offset = content && next ? movementOffset(current.element, content, next) : undefined
    cleanup(); setDragging(false)
    if (moved && targetId && next) onAction({ type: 'move', sourcePath, targetId, placement: next, sourceSlot: current.sourceSlot, offset })
  }
  const buttonClass = 'rounded border border-neutral-200 px-2 py-1.5 hover:bg-sky-50 disabled:opacity-40'
  return createPortal(<div ref={toolbarRef} data-awb-object-toolbar="true" role="toolbar" aria-label={`${target.kind} controls`} className="fixed z-[1000] w-max max-w-[calc(100vw-16px)] rounded-lg border border-sky-200 bg-white p-2 text-xs text-neutral-900 shadow-xl" style={{ top: target.top, left: target.left, fontFamily: 'Arial, sans-serif', opacity: dragging ? .6 : 1 }} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
    {sectionId && <SelectedObjectInteraction element={target.element} onStart={startDrag} onMove={(x, y) => { if (drag.current) { drag.current.latestX = x; drag.current.latestY = y } }} onFinish={finishDrag} onCancel={() => { cleanup(); setDragging(false) }} onNudge={nudge} />}
    <div className="flex flex-wrap items-center gap-1">
      {target.parentPath && <button type="button" className={buttonClass} title="Select the parent box and all its contents" onClick={() => onSelect(target.parentPath)}>↑ Parent</button>}
      {(target.kind === 'text' || target.kind === 'button') && <>
        <select aria-label="Object font family" className="max-w-28 rounded border p-1.5" value={String(style.fontFamily ?? '')} onChange={(event) => changeStyle({ fontFamily: event.target.value || undefined })}><option value="">{target.fontFamily.split(',')[0]}</option>{fonts.map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}</select>
        <NumberControl live label="Object font size" className="w-14 rounded border p-1.5" min={10} max={160} value={Number(style.fontSize ?? Math.round(target.fontSize))} onChange={(fontSize) => changeStyle({ fontSize })} />
        <button type="button" aria-label="Bold" aria-pressed={target.bold} className={`${buttonClass} font-bold ${target.bold ? 'bg-sky-100' : ''}`} onClick={() => changeStyle({ fontWeight: target.bold ? 400 : 700 })}>B</button>
        <button type="button" aria-label="Italic" aria-pressed={target.italic} className={`${buttonClass} italic ${target.italic ? 'bg-sky-100' : ''}`} onClick={() => changeStyle({ fontStyle: target.italic ? 'normal' : 'italic' })}>I</button>
        <label className="relative flex h-8 w-8 cursor-pointer flex-col items-center justify-center rounded border border-neutral-200 hover:bg-sky-50" title={`Text colour: ${textColor} — click to choose`}>
          <span aria-hidden="true" className="text-sm font-semibold leading-none">A</span>
          <span aria-hidden="true" className="mt-0.5 h-1 w-5 rounded-sm border border-neutral-300" style={{ backgroundColor: textColor }} />
          <input type="color" aria-label={`Text colour: ${textColor}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={textColor === 'transparent' ? '#ffffff' : textColor} onClick={() => setPanel('color')} onChange={(event) => changeStyle({ color: event.target.value })} />
        </label>
      </>}
      {target.kind === 'text' && textPointer && <TextLinkControl open={panel === 'link'} onOpenChange={open => setPanel(open ? 'link' : undefined)} element={target.element} links={(scope.props.inlineLinks as Record<string, InlineLink[]> | undefined)?.[scope.path] ?? []} onChange={links => onAction({ type: 'content', pointer: `${scope.prefix}/inlineLinks`, value: { ...((scope.props.inlineLinks ?? {}) as Record<string, InlineLink[]>), [scope.path]: links } })} />}
      {(target.kind === 'text' || target.kind === 'button') && <select aria-label="Text alignment" className="rounded border p-1.5" value={String(style.textAlign ?? target.textAlign)} onChange={(event) => changeStyle({ textAlign: event.target.value })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option></select>}
      {(target.kind === 'text' || target.kind === 'button') && <select aria-label="Vertical text alignment" title="Vertical alignment within the text box" className="rounded border p-1.5" value={String(style.verticalAlign ?? target.verticalAlign)} onChange={(event) => changeStyle({ verticalAlign: event.target.value })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select>}
      <select aria-label="Layer order" title="Arrange overlapping objects within their container. Detached objects share the section's layer order." className={buttonClass} value="" onChange={(event) => { if (event.target.value) onAction({ type: 'layer', direction: event.target.value as LayerDirection, sourcePath: layerPath }) }}>
        <option value="">Layers…</option><option value="front">Bring to front</option><option value="forward">Bring forward</option><option value="backward">Send backward</option><option value="back">Send to back</option><option value="reset">Reset layer order</option>
      </select>
      <button type="button" className={buttonClass} aria-expanded={panel === 'spacing'} onClick={() => setPanel(panel === 'spacing' ? undefined : 'spacing')}>Spacing</button>
      {(layoutPath || sectionId) && <button type="button" className={buttonClass} onClick={() => setPanel(panel === 'layout' ? undefined : 'layout')}>Layout</button>}
      {target.kind !== 'text' && <button type="button" className={buttonClass} onClick={() => setPanel(panel === 'size' ? undefined : 'size')}>Size</button>}
      {target.kind !== 'image' && <label className="relative flex h-8 cursor-pointer items-center gap-1.5 rounded border border-neutral-200 px-2 hover:bg-sky-50" title={`Background fill: ${backgroundColor} — click to choose`}>
        <span aria-hidden="true" className="h-4 w-4 rounded-sm border border-neutral-300" style={{ backgroundColor, backgroundImage: backgroundColor === 'transparent' ? 'linear-gradient(135deg, transparent 45%, #a3a3a3 45%, #a3a3a3 55%, transparent 55%)' : undefined }} />
        <span>BG fill</span>
        <input type="color" aria-label={`Background fill: ${backgroundColor}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor} onClick={() => setPanel('background')} onChange={(event) => changeStyle({ backgroundColor: event.target.value })} />
      </label>}
      {target.kind === 'image' && textPointer && <button type="button" className={buttonClass} onClick={() => setPanel(panel === 'image' ? undefined : 'image')}>Replace image</button>}
      {target.kind === 'button' && textPointer && <button type="button" className={buttonClass} onClick={() => setPanel(panel === 'content' ? undefined : 'content')}>Edit text{target.kind === 'button' ? ' / link' : ''}</button>}
      {sectionId && <>
        {scope.root && scope.entry?.source === '/layout/0' && <button type="button" className={buttonClass} title="Restore this moved layout as its own section, including its content and appearance" onClick={() => onAction({ type: 'restoreSection' })}>Restore as section</button>}
        <button type="button" className={buttonClass} aria-label="Duplicate object" title="Duplicate object with its contents; copied button links are cleared" onClick={() => onAction({ type: 'duplicate', placement: placement(target.element, node, 20, 20) })}>⧉</button>
        <button type="button" className={buttonClass} onClick={() => setPanel(panel === 'move' ? undefined : 'move')}>{sourcePath === '/layout/0' ? 'Move section…' : 'Move into section…'}</button>
      </>}
      <button type="button" className={`${buttonClass} text-red-700`} aria-label="Delete object" onClick={() => onAction({ type: 'delete' })}>✕</button>
    </div>
    {sectionId && <p className="mt-1 text-[10px] text-neutral-500">Drag to move · Arrows: 1px · Shift + arrows: 10px · Double-click text to edit</p>}
    {panel && panel !== 'link' && <div className="mt-2 max-h-[50vh] max-w-sm overflow-auto border-t pt-2">
      {panel === 'spacing' && <SpacingControls elements={[target.element]} appearances={[style]} onChange={changeStyle} />}
      {(panel === 'color' || panel === 'background') && <ColorInput label={panel === 'color' ? 'Text colour' : 'Background colour'} value={String(style[panel === 'color' ? 'color' : 'backgroundColor'] ?? (panel === 'color' ? target.color : target.background))} onChange={(value) => changeStyle({ [panel === 'color' ? 'color' : 'backgroundColor']: value })} />}
      {panel === 'image' && textPointer && <ImageField projectId={projectId} imageUrls={imageUrls} value={String(textValue ?? '')} onChange={(value) => onAction({ type: 'content', pointer: textPointer, value })} />}
      {panel === 'content' && textPointer && <div className="grid gap-2"><label>Text<textarea className="mt-1 w-full rounded border p-2" value={String(textValue ?? '')} onChange={(event) => onAction({ type: 'content', pointer: textPointer, value: event.target.value })} /></label>{target.kind === 'button' && <label>Link<input className="mt-1 w-full rounded border p-2" value={String(getAtPointer(props, `${scope.prefix}${scope.path}/href`) ?? '')} onChange={(event) => onAction({ type: 'content', pointer: `${scope.prefix}${scope.path}/href`, value: event.target.value })} /></label>}</div>}
      {panel === 'size' && target.kind !== 'text' && <div className="grid gap-2">
        <p>Drag the blue edges and corners, or enter dimensions below. Text corners adjust font size; block corners resize the box.</p>
        <label>{sectionId ? 'Width (% of section)' : 'Width (%)'}<NumberControl label="Object width" min={10} max={100} value={scope.root ? scope.entry!.width : target.kind === 'image' && sectionId ? Math.round(target.element.getBoundingClientRect().width / Math.max(1, node.getBoundingClientRect().width) * 100) : target.kind === 'image' ? Number((scope.props.imageSizes as Record<string, Record<string, unknown>> | undefined)?.[scope.path]?.width ?? 100) : sectionId && target.kind === 'button' && style.widthBasis !== 'section' ? Math.round(target.element.getBoundingClientRect().width / Math.max(1, node.getBoundingClientRect().width) * 100) : Number(style.width ?? 100)} onChange={(width) => onAction(target.kind === 'image' && sectionId ? imagePlacementAction(target.element, node, sectionId, { width }) : scope.root ? { type: 'placement', value: { width } } : { type: target.kind === 'image' ? 'imageSize' : 'style', value: { width, ...(sectionId && target.kind === 'button' ? { widthBasis: 'section' } : {}) } })} /></label>
        {sectionId && (target.kind === 'image' || scope.root) && <button type="button" className={buttonClass} onClick={() => onAction(scope.root ? { type: 'placement', value: { x: 0, width: 100 } } : imagePlacementAction(target.element, node, sectionId, { width: 100 }))}>Full section width</button>}
        {sectionId && target.kind === 'button' && <button type="button" className={buttonClass} onClick={() => onAction({ type: 'fullWidth', offsetX: node.getBoundingClientRect().left - target.element.getBoundingClientRect().left, height: target.element.getBoundingClientRect().height })}>Full section width</button>}
        {<label>Height (px)<NumberControl label="Object height" min={target.kind === 'image' ? 40 : 24} max={target.kind === 'image' && !scope.root ? 1600 : 3000} value={Math.round(scope.root ? scope.entry!.height : target.element.getBoundingClientRect().height)} onChange={(height) => onAction(scope.root ? { type: 'placement', value: { height } } : { type: target.kind === 'image' ? 'imageSize' : 'style', value: { height } })} /></label>}
        {target.kind === 'image' && <label>Image fit<select aria-label="Image fit" className="ml-2 rounded border p-1" value={String((scope.props.imageSizes as Record<string, Record<string, unknown>> | undefined)?.[scope.path]?.fit ?? 'cover')} onChange={(event) => onAction({ type: 'imageSize', value: { fit: event.target.value } })}><option value="cover">Fill / crop</option><option value="contain">Fit whole image</option></select></label>}
        {target.kind !== 'image' && <label>Corner radius (px)<NumberControl label="Corner radius" min={0} max={200} value={Number(style.borderRadius ?? 0)} onChange={(borderRadius) => changeStyle({ borderRadius })} /></label>}
        {target.kind !== 'image' && <label>Opacity<input aria-label="Object opacity" type="range" min={0.1} max={1} step={0.05} value={Number(style.opacity ?? 1)} onChange={(event) => changeStyle({ opacity: Number(event.target.value) })} /></label>}
      </div>}
      {panel === 'layout' && <div className="grid gap-3">
        {sectionId && <div className="grid gap-2 border-b pb-3">
          <p className="font-semibold">Free placement</p>
          <p className="text-neutral-500">Release this object from its column to move and resize it across the section. Groups keep their children together. Other objects retain their space.</p>
          <button type="button" className={buttonClass} disabled={scope.root} onClick={() => { onAction({ type: 'move', sourcePath, targetId: sectionId, sourceSlot: flowSlot(movementElement), placement: placement(movementElement, node) }); setPanel(undefined) }}>{scope.root ? 'Already freely placed' : 'Detach from columns'}</button>
          <p className="text-neutral-500">Use Move to… for another section. Check tablet and mobile after manual placement.</p>
        </div>}
        {layoutPath && <>
        <p className="font-semibold">{target.kind === 'image' ? 'Image and surrounding content' : 'Arrange this container'}</p>
        <p className="text-neutral-500">Stack places children on full-width rows. Columns adapt to smaller screens. This deliberately rearranges the layout; dragging still preserves other objects’ positions.</p>
        <label>Arrangement<select aria-label="Container arrangement" className="mt-1 w-full rounded border p-2" value={Number(layoutStyle.layoutColumns ?? 0)} onChange={(event) => changeLayout({ layoutColumns: Number(event.target.value) || undefined })}>
          <option value={0}>Original layout</option><option value={1}>Stack — full-width rows</option><option value={2}>2 responsive columns</option><option value={3}>3 responsive columns</option><option value={4}>4 responsive columns</option>
        </select></label>
        <label>Space between items (px)<NumberControl label="Layout spacing" min={0} max={160} value={Number(layoutStyle.layoutGap ?? 24)} onChange={(layoutGap) => changeLayout({ layoutColumns: Number(layoutStyle.layoutColumns ?? 1), layoutGap })} /></label>
        <p className="text-neutral-500">Select a cards container to arrange its cards. Use Parent to select the surrounding layout.</p>
        {target.kind === 'image' && <button type="button" className={`${buttonClass} text-red-700`} onClick={() => onAction({ type: 'delete' })}>Remove image and its empty frame</button>}
        </>}
      </div>}
      {panel === 'move' && <div className="grid gap-2"><p>{sourcePath === '/layout/0' ? 'Reorder this whole section beside the chosen section. Its content and background stay together.' : 'Place this object inside another section. Its children move with it; the source section remains.'}</p><select aria-label="Destination section" value="" className="rounded border p-2" onChange={(event) => { if (event.target.value) { const next = { ...placement(movementElement, node), x: 5, y: 40 }; onAction({ type: 'move', sourcePath, targetId: event.target.value, sourceSlot: flowSlot(movementElement), placement: next, offset: movementOffset(movementElement, node, next) }); setPanel(undefined) } }}><option value="">Choose section…</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></div>}
    </div>}
  </div>, document.body)
}
