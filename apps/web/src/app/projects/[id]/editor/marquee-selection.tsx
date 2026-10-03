'use client'
import { useEffect, useRef } from 'react'

type Rectangle = { left: number; right: number; top: number; bottom: number }
export function marqueeTargets(elements: HTMLElement[], area: Rectangle): HTMLElement[] {
  const candidates = elements.filter((element) => {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height || element.matches('section')) return false
    const inside = rect.left >= area.left && rect.right <= area.right && rect.top >= area.top && rect.bottom <= area.bottom
    const structural = element.dataset.awbElement?.startsWith('/layout/') || /\/content\/layout\//.test(element.dataset.awbElement ?? '')
    if (structural && !element.hasAttribute('data-awb-image-container')) return false
    if (element.querySelector('[data-awb-element]') && !inside) return false
    return rect.left < area.right && rect.right > area.left && rect.top < area.bottom && rect.bottom > area.top
  })
  return candidates.filter((element) => !candidates.some((parent) => parent !== element && parent.contains(element)))
}

type Options = { enabled: boolean; paths: string[]; sectionId?: string; onSelect: (sectionId: string, paths: string[]) => void }
export function MarqueeSelection({ node, ...options }: Options & { node: HTMLElement | null }) {
  const current = useRef(options)
  useEffect(() => { current.current = options }, [options])
  useEffect(() => node ? bindMarqueeSelection(node, () => current.current) : undefined, [node])
  return null
}

export function bindMarqueeSelection(node: HTMLElement, options: () => Options) {
  let active: { x: number; y: number; box: HTMLDivElement; pointer: number; path?: string; sectionId?: string; additive: boolean } | undefined
  const cancel = () => { active?.box.remove(); active = undefined }
  const suppressClick = () => { node.dataset.awbMarqueeHandled = 'true'; setTimeout(() => { delete node.dataset.awbMarqueeHandled }, 150) }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || (!options().enabled && !event.shiftKey)) return
    const target = event.target as HTMLElement
    if (target.isContentEditable || target.closest('input,textarea,select')) return
    event.preventDefault(); event.stopPropagation()
    const box = document.createElement('div')
    Object.assign(box.style, { position: 'fixed', zIndex: '10001', pointerEvents: 'none', border: '1px solid #0284c7', background: 'rgba(14,165,233,.12)' })
    document.body.appendChild(box)
    active = { x: event.clientX, y: event.clientY, pointer: event.pointerId, box, path: target.closest<HTMLElement>('[data-awb-element]')?.dataset.awbElement, sectionId: target.closest<HTMLElement>('[data-awb-section-id]')?.dataset.awbSectionId, additive: event.shiftKey }
    node.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointer) return
    Object.assign(active.box.style, { left: `${Math.min(active.x, event.clientX)}px`, top: `${Math.min(active.y, event.clientY)}px`, width: `${Math.abs(active.x - event.clientX)}px`, height: `${Math.abs(active.y - event.clientY)}px` })
  }
  const up = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointer) return
    const { x, y, path, sectionId, additive } = active
    cancel()
    if (Math.abs(event.clientX - x) + Math.abs(event.clientY - y) < 6) {
      if (path && sectionId) {
        suppressClick()
        const previous = options().sectionId === sectionId ? options().paths : []
        options().onSelect(sectionId, additive ? previous.includes(path) ? previous.filter((entry) => entry !== path) : [...previous, path] : [path])
      }
      return
    }
    const area = { left: Math.min(x, event.clientX), right: Math.max(x, event.clientX), top: Math.min(y, event.clientY), bottom: Math.max(y, event.clientY) }
    const sections = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-section-id]'))
    const overlap = (element: HTMLElement) => { const rect = element.getBoundingClientRect(); return Math.max(0, Math.min(rect.right, area.right) - Math.max(rect.left, area.left)) * Math.max(0, Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top)) }
    const section = sections.find((entry) => entry.dataset.awbSectionId === sectionId) ?? sections.filter((entry) => overlap(entry) > 0).sort((a, b) => overlap(b) - overlap(a))[0]
    if (!section) return
    const elements = Array.from(section.querySelectorAll<HTMLElement>('[data-awb-section-content] [data-awb-element]'))
    const selected = marqueeTargets(elements, area).map((element) => element.dataset.awbElement!)
    suppressClick()
    options().onSelect(section.dataset.awbSectionId!, selected)
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
  node.addEventListener('pointerdown', down, true); node.addEventListener('pointermove', move); node.addEventListener('pointerup', up); node.addEventListener('pointercancel', cancel); node.addEventListener('lostpointercapture', cancel)
  window.addEventListener('keydown', key)
  return () => { cancel(); node.removeEventListener('pointerdown', down, true); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', cancel); node.removeEventListener('lostpointercapture', cancel); window.removeEventListener('keydown', key) }
}
