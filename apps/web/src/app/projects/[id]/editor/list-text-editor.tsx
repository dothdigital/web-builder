'use client'
import { useRef } from 'react'
import { formatListSelection } from '@/lib/text-lists'
export function ListTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return <div className="grid gap-1"><div className="flex flex-wrap gap-1" role="group" aria-label="List formatting">
    {([['bullet', '• Bullets'], ['number', '1. Numbered'], ['plain', 'Remove list']] as const).map(([mode, title]) => <button key={mode} type="button" className="rounded border px-2 py-1 text-xs" onClick={() => {
      const field = ref.current
      if (!field) return
      const next = formatListSelection(value, field.selectionStart, field.selectionEnd, mode)
      onChange(next.text)
      requestAnimationFrame(() => { field.focus(); field.setSelectionRange(next.start, next.end) })
    }}>{title}</button>)}
  </div><label className="grid gap-1 text-xs">{label}<textarea ref={ref} rows={6} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" value={value} onChange={event => onChange(event.target.value)} /></label><p className="text-[11px] text-neutral-500">Select lines, then choose Bullets or Numbered. Each line becomes one item.</p></div>
}
