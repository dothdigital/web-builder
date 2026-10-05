'use client'
import { ErrorNotice } from '@/components/error-notice'

import { useState } from 'react'
import { safeTextLink, textOccurrence, type InlineLink } from '@awb/component-registry'
import { flushInlineTextEdits } from './inline-edit'

export function captureTextLink(element: HTMLElement): { text: string; occurrence: number } | undefined {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return
  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return
  if (range.collapsed) {
    const anchor = (range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement)?.closest('a[data-awb-text-link]')
    if (!anchor || !element.contains(anchor)) return
    const prefix = document.createRange(); prefix.selectNodeContents(element); prefix.setEndBefore(anchor)
    const text = anchor.textContent ?? ''
    return text ? { text, occurrence: textOccurrence(element.textContent ?? '', text, prefix.toString().length) } : undefined
  }
  const text = range.toString()
  if (!text.trim()) return
  const prefix = range.cloneRange(); prefix.selectNodeContents(element); prefix.setEnd(range.startContainer, range.startOffset)
  return { text, occurrence: textOccurrence(element.textContent ?? '', text, prefix.toString().length) }
}
export function TextLinkControl({ element, links, onChange, open, onOpenChange: setOpen }: { element: HTMLElement; links: InlineLink[]; onChange: (links: InlineLink[]) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState<{ text: string; occurrence: number }>()
  const [href, setHref] = useState('')
  const [newTab, setNewTab] = useState(false)
  const [error, setError] = useState('')
  const choose = (selection: { text: string; occurrence: number } | undefined) => {
    setSelected(selection); setError('')
    const previous = links.find(link => link.text === selection?.text && link.occurrence === selection.occurrence)
    setHref(previous?.href ?? ''); setNewTab(previous?.newTab ?? false); setOpen(true)
  }
  const apply = (remove = false) => {
    if (!selected) return
    const url = href.trim()
    if (!remove && !safeTextLink(url)) { setError('Use https://example.com, /page, #section, mailto: or tel:.'); return }
    flushInlineTextEdits()
    const kept = links.filter(link => !(link.text === selected.text && link.occurrence === selected.occurrence))
    onChange(remove ? kept : [...kept, { ...selected, href: url, newTab }]); setOpen(false)
  }
  return <div className="relative">
    <button type="button" aria-label="Hyperlink selected text" aria-expanded={open} className="rounded border border-neutral-200 px-2 py-1.5 hover:bg-sky-50" onPointerDown={event => { event.preventDefault(); event.stopPropagation(); choose(captureTextLink(element)) }} onClick={event => { if (event.detail === 0) choose(captureTextLink(element)) }}>↗ Link</button>
    {open && <div role="dialog" aria-label="Text hyperlink" className="absolute left-0 top-full z-10 mt-2 w-72 rounded border bg-white p-3 shadow-xl" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false) }}>
      {selected ? <>
        <p className="mb-2 truncate">Link: “{selected.text}”</p>
        <label>URL<input aria-label="Text hyperlink URL" className="mt-1 w-full rounded border p-2" value={href} placeholder="https://example.com or /contact" onChange={event => setHref(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply() } }} /></label>
        <label className="my-2 flex items-center gap-2"><input type="checkbox" checked={newTab} onChange={event => setNewTab(event.target.checked)} />Open in a new tab</label>
        {error && <ErrorNotice code="WT-EDITOR-001" message={error} className="mb-2 text-red-700" />}
        <div className="flex gap-2"><button type="button" className="rounded bg-sky-700 px-2 py-1 text-white" onClick={() => apply()}>Apply link</button><button type="button" className="rounded border px-2 py-1" onClick={() => apply(true)}>Remove link</button></div>
      </> : <><p>Double-click the text, highlight the words to link, then click Link.</p>{links.length > 0 && <div className="mt-2 grid gap-1">{links.map((link, i) => <button type="button" key={i} className="truncate rounded border p-1 text-left" onClick={() => choose(link)}>Edit link: {link.text}</button>)}</div>}</>}
      <button type="button" className="mt-2 underline" onClick={() => setOpen(false)}>Close</button>
    </div>}
  </div>
}
