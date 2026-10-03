'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { WebsiteSection } from '@awb/website-model'
import { getComponent } from '@awb/component-registry'
import { sectionDropSlot } from '@/lib/section-order'

export function SectionReorderList({ sections, onReorder, children }: { sections: WebsiteSection[]; onReorder: (id: string, slot: number) => void; children: (section: WebsiteSection, index: number, dragging: boolean) => ReactNode }) {
  const list = useRef<HTMLOListElement>(null)
  const [active, setActive] = useState<string>()
  const [drop, setDrop] = useState<number>()
  const [announcement, setAnnouncement] = useState('')
  const drag = useRef<{ id: string; x: number; y: number; latestX: number; latestY: number; moved: boolean; ghost: HTMLDivElement; raf: number; slot?: number } | null>(null)
  const release = () => { const current = drag.current; if (current) { cancelAnimationFrame(current.raf); current.ghost.remove() }; drag.current = null }
  const cancel = () => { release(); setActive(undefined); setDrop(undefined) }
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag.current) { release(); setActive(undefined); setDrop(undefined); setAnnouncement('Section move cancelled.') } }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); release() }
  }, [])
  const update = () => {
    const current = drag.current, root = list.current
    if (!current || !root) return
    current.moved ||= Math.abs(current.latestY - current.y) + Math.abs(current.latestX - current.x) > 4
    current.ghost.style.top = `${current.latestY + 12}px`
    current.ghost.style.left = `${current.latestX + 12}px`
    const bounds = root.getBoundingClientRect()
    if (!current.moved || current.latestX < bounds.left - 24 || current.latestX > bounds.right + 24) { current.slot = undefined; setDrop(undefined); return }
    const rows = Array.from(root.querySelectorAll<HTMLElement>(':scope > li[data-section-row]'))
    current.slot = sectionDropSlot(rows.map((row) => { const rect = row.getBoundingClientRect(); return rect.top + rect.height / 2 }), current.latestY)
    setDrop(current.slot)
  }
  return <>
    <p className="px-4 pt-2 text-[11px] text-neutral-500">Drag ⠿ to reorder sections. Arrow keys also work on the handle.</p>
    <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
    <ol ref={list} className="grid gap-1 p-2" aria-label="Page sections">
      {sections.map((section, index) => {
        const label = String(section.props.heading || getComponent(section.componentId)?.name || section.componentId)
        return <li key={section.id} data-section-row={section.id} className={`relative flex items-start rounded-md transition-colors ${active === section.id ? 'bg-sky-50 opacity-50' : ''}`}>
          {drop === index && <div className="pointer-events-none absolute -top-1 left-0 right-0 z-10 h-0.5 rounded bg-sky-500"><span className="absolute -left-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" /></div>}
          <button type="button" aria-label={`Reorder ${label}`} title="Drag up or down to reorder. Arrow keys move one position; Escape cancels." className="mt-1 shrink-0 cursor-grab rounded px-1.5 py-2 text-neutral-400 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 active:cursor-grabbing" style={{ touchAction: 'none' }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault(); event.stopPropagation()
            const next = index + (event.key === 'ArrowUp' ? -1 : 1)
            if (next < 0 || next >= sections.length) return
            onReorder(section.id, event.key === 'ArrowUp' ? index - 1 : index + 2)
            setAnnouncement(`${label} moved to position ${next + 1} of ${sections.length}.`)
          }} onPointerDown={(event) => {
            if (event.button !== 0 || !list.current) return
            event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
            const ghost = document.createElement('div'); ghost.textContent = label
            Object.assign(ghost.style, { position: 'fixed', top: `${event.clientY + 12}px`, left: `${event.clientX + 12}px`, maxWidth: '260px', padding: '10px 14px', background: '#fff', color: '#0c4a6e', border: '1px solid #38bdf8', borderRadius: '8px', boxShadow: '0 8px 24px #0002', font: '13px Arial, sans-serif', zIndex: '10001', pointerEvents: 'none' })
            document.body.appendChild(ghost)
            drag.current = { id: section.id, x: event.clientX, y: event.clientY, latestX: event.clientX, latestY: event.clientY, moved: false, ghost, raf: 0 }
            setActive(section.id)
            const tick = () => {
              const current = drag.current
              if (!current) return
              const scroller = list.current?.closest<HTMLElement>('aside')
              if (scroller && current.moved) { const rect = scroller.getBoundingClientRect(); const speed = current.latestY < rect.top + 56 ? -Math.min(16, (rect.top + 56 - current.latestY) / 3) : current.latestY > rect.bottom - 56 ? Math.min(16, (current.latestY - rect.bottom + 56) / 3) : 0; scroller.scrollTop += speed }
              update(); current.raf = requestAnimationFrame(tick)
            }
            drag.current.raf = requestAnimationFrame(tick)
          }} onPointerMove={(event) => { if (drag.current) { drag.current.latestX = event.clientX; drag.current.latestY = event.clientY; update() } }} onPointerUp={(event) => {
            const current = drag.current
            if (!current) return
            current.latestX = event.clientX; current.latestY = event.clientY; update()
            const slot = current.slot, moved = current.moved
            cancel()
            if (moved && slot !== undefined) { onReorder(section.id, slot); setAnnouncement(`${label} moved to position ${(index < slot ? slot - 1 : slot) + 1} of ${sections.length}.`) }
          }} onPointerCancel={cancel} onLostPointerCapture={cancel}>⠿</button>
          <div className="min-w-0 flex-1">{children(section, index, !!active)}</div>
          {drop === sections.length && index === sections.length - 1 && <div className="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 h-0.5 rounded bg-sky-500" />}
        </li>
      })}
    </ol>
  </>
}
