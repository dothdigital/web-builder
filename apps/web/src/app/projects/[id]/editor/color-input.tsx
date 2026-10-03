'use client'

import { useRef, useState } from 'react'

function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${hex.split('').map((character) => character.repeat(2)).join('').toUpperCase()}`
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`
  return undefined
}

export function ColorInput({ value, onChange, label = 'Colour' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const normalized = value === 'transparent' ? 'transparent' : normalizeHex(value) ?? '#000000'
  const commit = () => {
    if (draft === null) return
    const next = normalizeHex(draft)
    if (!next) { setMessage('Enter a hex code such as #123ABC.'); return }
    onChange(next); setDraft(null); setMessage('')
  }
  return <div className="grid min-w-0 gap-1">
    <div className="flex min-w-0 items-center gap-2">
      <input aria-label={`${label} picker`} type="color" className="h-9 w-9 shrink-0 cursor-pointer rounded border border-neutral-300 p-1" value={normalized === 'transparent' ? '#ffffff' : normalized} title={normalized === 'transparent' ? 'Transparent — choose a colour to add a fill' : normalized} onChange={(event) => { onChange(event.target.value); setDraft(null); setMessage('') }} />
      <input ref={input} aria-label={`${label} hex code`} className="h-9 min-w-0 w-full rounded border border-neutral-300 px-2 font-mono text-xs" value={draft ?? normalized} spellCheck={false} onChange={(event) => { setDraft(event.target.value); setMessage('') }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } if (event.key === 'Escape') { setDraft(null); setMessage('') } }} onPaste={(event) => { const next = normalizeHex(event.clipboardData.getData('text')); if (next) { event.preventDefault(); onChange(next); setDraft(null); setMessage('') } }} />
      <button type="button" aria-label={`Copy ${label} hex code`} className="shrink-0 rounded border border-neutral-300 px-2 py-2 text-xs" onClick={async () => {
        const next = (draft ?? value) === 'transparent' ? 'transparent' : normalizeHex(draft ?? value)
        if (!next) { setMessage('Enter a valid hex code first.'); return }
        try { await navigator.clipboard.writeText(next); setMessage('Copied') }
        catch { input.current?.focus(); input.current?.select(); setMessage('Press Ctrl+C or ⌘C to copy.') }
      }}>Copy</button>
    </div>
    {message && <span role="status" className="text-xs text-neutral-600">{message}</span>}
  </div>
}
