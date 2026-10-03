'use client'
import { useEffect, useRef, useState } from 'react'

const handles = [
  { name: 'top left', x: 0, y: 0, cursor: 'nwse-resize' },
  { name: 'top middle', x: 0.5, y: 0, cursor: 'ns-resize' },
  { name: 'top right', x: 1, y: 0, cursor: 'nesw-resize' },
  { name: 'right middle', x: 1, y: 0.5, cursor: 'ew-resize' },
  { name: 'bottom right', x: 1, y: 1, cursor: 'nwse-resize' },
  { name: 'bottom middle', x: 0.5, y: 1, cursor: 'ns-resize' },
  { name: 'bottom left', x: 0, y: 1, cursor: 'nesw-resize' },
  { name: 'left middle', x: 0, y: 0.5, cursor: 'ew-resize' },
] as const

function restoreSizing(start: { element: HTMLElement; originalStyle: string; container?: HTMLElement; containerStyle?: string }) {
  start.element.style.cssText = start.originalStyle
  if (start.container) start.container.style.cssText = start.containerStyle ?? ''
}

export function ImageResizeHandle({ revision, node, path, onResize, onFontResize, sectionWideImages = false }: { sectionWideImages?: boolean; revision?: unknown; node: HTMLElement | null; path?: string; onResize: (size: { width: number; height: number }) => void; onFontResize: (style: { fontSize?: number; width?: number; height?: number; widthBasis?: 'section' }) => void }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number; path: string; kind: 'image' | 'text' | 'block' }>()
  const image = useRef<HTMLElement | null>(null)
  const drag = useRef<{ x: number; y: number; width: number; height: number; parentWidth: number; originalStyle: string; container?: HTMLElement; containerStyle?: string; element: HTMLElement; kind: 'image' | 'text' | 'block'; fontSize: number; resultFont?: number; resultWidth?: number; resultHeight?: number; result?: { width: number; height: number } } | null>(null)
  useEffect(() => {
    if (!node || !path) return
    const target = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]')).find((entry) => entry.dataset.awbElement === path)
    if (!target || (getComputedStyle(target).position === 'absolute' && !target.hasAttribute('data-awb-free-item') && !target.parentElement?.hasAttribute('data-awb-width-slot'))) return
    const kind = target.hasAttribute('data-awb-inline-text') ? 'text' : target.hasAttribute('data-awb-free-item') || target.matches('div:not([role="img"]),article,ul,ol,form,details,section,nav,aside') ? 'block' : target.matches('img,[role="img"]') ? 'image' : 'text'
    if (kind === 'text' && !target.hasAttribute('data-awb-inline-text') && !target.matches('h1,h2,h3,h4,h5,h6,p,span,strong,blockquote,a,button,li,summary')) return
    image.current = target
    const measure = () => {
      const bounds = target.getBoundingClientRect()
      const parent = node.parentElement!.getBoundingClientRect()
      setBox({ left: bounds.left - parent.left, top: bounds.top - parent.top, width: bounds.width, height: bounds.height, path, kind })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    observer.observe(node)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect(); window.removeEventListener('resize', measure)
      if (drag.current) { restoreSizing(drag.current); drag.current = null }
      image.current = null
    }
  }, [node, path, revision])
  if (!box || box.path !== path) return null
  return <>{handles.map((handle) => <button key={handle.name} type="button" aria-label={`Resize ${box.kind} from ${handle.name}`} title={box.kind === 'image' ? 'Drag an edge to adjust one dimension. Drag a corner to resize proportionally; hold Shift for free resizing.' : box.kind === 'block' ? 'Drag any edge or corner to resize the box. Its contents move with it.' : 'Drag side handles for section-wide text width, top/bottom handles for box height, and corners for font size.'} className="absolute z-30 h-[18px] w-[18px] rounded-sm border-2 border-white bg-sky-600 shadow" style={{ left: box.left + box.width * handle.x - 9, top: box.top + box.height * handle.y - 9, cursor: handle.cursor, touchAction: 'none' }}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      event.preventDefault(); event.stopPropagation(); event.currentTarget.focus()
      const target = image.current
      if (!target || event.button !== 0) return
      const bounds = target.getBoundingClientRect()
      const container = box.kind === 'image' && target.parentElement?.hasAttribute('data-awb-image-container') ? target.parentElement : undefined
      drag.current = { container, containerStyle: container?.style.cssText, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, parentWidth: box.kind === 'text' || (box.kind === 'image' && sectionWideImages) ? node!.getBoundingClientRect().width : (container?.parentElement ?? target.parentElement)!.getBoundingClientRect().width, originalStyle: target.style.cssText, element: target, kind: box.kind, fontSize: parseFloat(getComputedStyle(target).fontSize) }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => {
      const start = drag.current
      if (!start) return
      const dx = (event.clientX - start.x) * (handle.x * 2 - 1)
      const dy = (event.clientY - start.y) * (handle.y * 2 - 1)
      if (start.kind === 'block') {
        if (handle.x !== 0.5) start.resultWidth = Math.max(10, Math.min(100, Math.round((start.width + dx) / Math.max(1, start.parentWidth) * 100)))
        if (handle.y !== 0.5) start.resultHeight = Math.max(24, Math.min(3000, Math.round(start.height + dy)))
        if (start.resultWidth !== undefined) start.element.style.width = `${start.resultWidth}%`
        if (start.resultHeight !== undefined) Object.assign(start.element.style, { height: `${start.resultHeight}px`, minHeight: '0', boxSizing: 'border-box' })
        return
      }
      if (start.kind === 'text') {
        if (handle.x === 0.5) {
          start.resultHeight = Math.max(24, Math.min(3000, Math.round(start.height + dy)))
          Object.assign(start.element.style, { height: `${start.resultHeight}px`, boxSizing: 'border-box', minHeight: '0', ...(start.element.matches('a,button') ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.6rem' } : {}) })
          return
        }
        if (handle.y === 0.5) {
          start.resultWidth = Math.max(10, Math.min(100, Math.round((start.width + dx) / Math.max(1, start.parentWidth) * 100)))
          Object.assign(start.element.style, { width: `${start.resultWidth / 100 * start.parentWidth}px`, minWidth: '0', maxWidth: 'none', height: `${start.height}px`, boxSizing: 'border-box', display: start.element.matches('a,button') ? 'inline-flex' : 'block', overflowWrap: 'anywhere', ...(start.element.matches('a,button') ? { padding: '0.4rem 0.6rem' } : {}) })
          return
        }
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
        start.resultFont = Math.max(10, Math.min(160, Math.round(start.fontSize + delta / 3)))
        start.element.style.fontSize = `${start.resultFont}px`
        return
      }
      const ratio = start.width / Math.max(1, start.height)
      const corner = handle.x !== 0.5 && handle.y !== 0.5
      const proportional = corner && !event.shiftKey
      const parentWidth = Math.max(1, start.parentWidth)
      let width = start.width + dx
      let height = start.height + dy
      if (proportional) {
        const delta = Math.abs(dx) >= Math.abs(dy * ratio) ? dx : dy * ratio
        const minWidth = Math.max(parentWidth * 0.1, 40 * ratio)
        const maxWidth = Math.min(parentWidth, 1600 * ratio)
        width = Math.max(Math.min(minWidth, maxWidth), Math.min(maxWidth, start.width + delta))
        height = width / ratio
      }
      start.result = { width: Math.max(10, Math.min(100, Math.round(width / parentWidth * 100))), height: Math.max(40, Math.min(1600, Math.round(height))) }
      if (start.container) Object.assign(start.container.style, { width: `${start.result.width / 100 * start.parentWidth}px`, maxWidth: 'none', height: 'auto', minHeight: '0', maxHeight: 'none' })
      Object.assign(start.element.style, { width: start.container ? '100%' : `${start.result.width / 100 * start.parentWidth}px`, minWidth: '0', maxWidth: 'none', height: `${start.result.height}px`, minHeight: '0', maxHeight: 'none', aspectRatio: 'auto' })
    }}
    onPointerUp={(event) => {
      const start = drag.current
      if (!start) return
      drag.current = null
      restoreSizing(start)
      event.currentTarget.releasePointerCapture(event.pointerId)
      if (start.kind === 'block') onFontResize({ ...(start.resultWidth !== undefined ? { width: start.resultWidth } : {}), ...(start.resultHeight !== undefined ? { height: start.resultHeight } : {}) })
      else if (start.resultHeight !== undefined) onFontResize({ height: start.resultHeight })
      else if (start.resultWidth !== undefined) onFontResize({ width: start.resultWidth, widthBasis: 'section', height: Math.max(24, Math.min(3000, start.height)) })
      else if (start.resultFont !== undefined) onFontResize({ fontSize: start.resultFont })
      else if (start.result) onResize(start.result)
    }}
    onKeyDown={(event) => { if (event.key === 'Escape' && drag.current) { restoreSizing(drag.current); drag.current = null; event.stopPropagation() } }}
    onLostPointerCapture={() => { if (drag.current) { restoreSizing(drag.current); drag.current = null } }}
    onPointerCancel={() => { if (drag.current) restoreSizing(drag.current); drag.current = null }}
  />)}</>
}
