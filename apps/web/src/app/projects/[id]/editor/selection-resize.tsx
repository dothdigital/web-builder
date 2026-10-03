'use client'
import { useEffect, useRef, useState } from 'react'
import type { MultiAction } from '@/lib/multi-object-editing'
import { objectScope } from '@/lib/object-editing'

type Bounds = { left: number; top: number; width: number; height: number }
export function SelectionResize({ elements, section, props, onAction }: { elements: HTMLElement[]; section: HTMLElement; props: Record<string, unknown>; onAction: (action: MultiAction) => void }) {
  const [ghost, setGhost] = useState<Bounds>()
  const drag = useRef<{ x: number; y: number; signX: number; signY: number; anchorX: number; anchorY: number; factor: number; original: Bounds; boxes: DOMRect[]; min: number; max: number } | null>(null)
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { drag.current = null; setGhost(undefined) } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [])
  const boxes = elements.map((element) => element.getBoundingClientRect())
  const left = Math.min(...boxes.map((box) => box.left)), top = Math.min(...boxes.map((box) => box.top))
  const original = { left, top, width: Math.max(...boxes.map((box) => box.right)) - left, height: Math.max(...boxes.map((box) => box.bottom)) - top }
  const bounds = ghost ?? original
  return <div onClick={(event) => event.stopPropagation()} aria-label="Selection resize bounds" style={{ position: 'fixed', left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, pointerEvents: 'none', border: '1px dashed #0284c7', zIndex: 999 }}>
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => <button key={`${x}-${y}`} type="button" aria-label={`Resize selection proportionally from ${y ? 'bottom' : 'top'} ${x ? 'right' : 'left'}`} title="Resize all selected objects proportionally" className="absolute h-4 w-4 rounded-sm border-2 border-white bg-sky-600 shadow" style={{ pointerEvents: 'auto', left: `${x! * 100}%`, top: `${y! * 100}%`, translate: '-50% -50%', cursor: x === y ? 'nwse-resize' : 'nesw-resize', touchAction: 'none' }} onPointerDown={(event) => {
      event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
      const sectionBox = section.getBoundingClientRect()
      const scales = elements.map((element) => objectScope(props, element.dataset.awbElement!).entry?.contentScale ?? 1)
      const anchorX = x ? original.left : original.left + original.width, anchorY = y ? original.top : original.top + original.height
      const min = Math.max(...boxes.map((box, i) => Math.max(sectionBox.width * .1 / Math.max(1, box.width), 24 / Math.max(1, box.height), .1 / scales[i]!)))
      const max = Math.min(...boxes.map((box, i) => Math.min(sectionBox.width / Math.max(1, box.width), 3000 / Math.max(1, box.height), 10 / scales[i]!)), (x ? sectionBox.right - anchorX : anchorX - sectionBox.left) / Math.max(1, original.width), y ? Infinity : (anchorY - sectionBox.top) / Math.max(1, original.height))
      drag.current = { x: event.clientX, y: event.clientY, signX: x ? 1 : -1, signY: y ? 1 : -1, anchorX, anchorY, factor: 1, original, boxes, min: Math.min(1, min), max: Math.max(1, max) }
    }} onPointerMove={(event) => {
      const current = drag.current
      if (!current) return
      const { width, height } = current.original
      current.factor = Math.max(current.min, Math.min(current.max, 1 + ((event.clientX - current.x) * current.signX * width + (event.clientY - current.y) * current.signY * height) / Math.max(1, width * width + height * height)))
      setGhost({ left: current.signX > 0 ? current.anchorX : current.anchorX - width * current.factor, top: current.signY > 0 ? current.anchorY : current.anchorY - height * current.factor, width: width * current.factor, height: height * current.factor })
    }} onPointerUp={() => {
      const current = drag.current; drag.current = null; setGhost(undefined)
      if (!current || Math.abs(current.factor - 1) < .001) return
      const sectionBox = section.getBoundingClientRect(), factor = current.factor
      const nextLeft = current.signX > 0 ? current.anchorX : current.anchorX - current.original.width * factor, nextTop = current.signY > 0 ? current.anchorY : current.anchorY - current.original.height * factor
      onAction({ type: 'resize', items: elements.map((element, index) => {
        const box = current.boxes[index]!, style = getComputedStyle(element)
        return { path: element.dataset.awbElement!, scale: factor, placement: { x: (nextLeft + (box.left - current.original.left) * factor - sectionBox.left) / sectionBox.width * 100, y: nextTop + (box.top - current.original.top) * factor - sectionBox.top, width: box.width * factor / sectionBox.width * 100, height: box.height * factor }, slot: { width: box.width, height: box.height, display: 'block', marginTop: parseFloat(style.marginTop) || 0, marginBottom: parseFloat(style.marginBottom) || 0, marginLeft: parseFloat(style.marginLeft) || 0, marginRight: parseFloat(style.marginRight) || 0 } }
      }) })
    }} onPointerCancel={() => { drag.current = null; setGhost(undefined) }} />)}
  </div>
}
