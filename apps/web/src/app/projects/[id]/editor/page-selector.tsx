'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WebsitePage } from '@awb/website-model'

export function PageSelector({ pages, page, onChange }: { pages: WebsitePage[]; page: WebsitePage; onChange: (id: string) => void }) {
  const pickerId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>()
  useEffect(() => {
    if (!position) return
    popup.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus()
    const outside = (event: PointerEvent) => { if (!popup.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setPosition(undefined) }
    const close = () => setPosition(undefined)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close) }
  }, [position])
  return <>
    <button ref={button} type="button" aria-label={`Select page: ${page.title}, ${page.path}`} aria-expanded={!!position} aria-controls={pickerId} title={`${page.title} · ${page.path}`} className="flex w-48 shrink-0 items-center gap-2 rounded-md border border-neutral-300 px-2 py-1.5 text-left text-sm" onClick={() => {
      if (position) { setPosition(undefined); return }
      const rect = button.current!.getBoundingClientRect()
      const width = Math.min(560, window.innerWidth - 24)
      setPosition({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width })
    }}><span className="min-w-0 flex-1 truncate">{page.title}</span><span aria-hidden="true">▾</span></button>
    {position && createPortal(<div id={pickerId} ref={popup} aria-label="Website pages" className="fixed z-[200] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl" style={{ ...position, maxHeight: `min(65vh, calc(100vh - ${position.top + 12}px))` }} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== button.current) setPosition(undefined) }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); setPosition(undefined); button.current?.focus() }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }}>{pages.map((candidate) => <button key={candidate.id} type="button" aria-current={candidate.id === page.id ? 'page' : undefined} className={`block w-full rounded-md px-3 py-2 text-left hover:bg-neutral-100 focus:bg-sky-50 ${candidate.id === page.id ? 'bg-sky-50 text-sky-900' : 'text-neutral-800'}`} onClick={() => { onChange(candidate.id); setPosition(undefined); button.current?.focus() }}><span className="block whitespace-normal break-words text-sm font-medium">{candidate.title}</span><span className="block whitespace-normal break-all text-xs text-neutral-500">{candidate.path}</span></button>)}</div>, document.body)}
  </>
}
