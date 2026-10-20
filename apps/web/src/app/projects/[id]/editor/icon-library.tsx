'use client'
import { useEffect, useState } from 'react'
import { iconImage, type LibraryIcon } from '@/lib/icon-image'

export function IconLibrary({ onUse }: { onUse: (url: string, alt: string) => void }) {
  const [icons, setIcons] = useState<Record<string, LibraryIcon>>()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [color, setColor] = useState('#172554')
  const [size, setSize] = useState(64)
  const [limit, setLimit] = useState(60)
  useEffect(() => { let active = true; fetch('/icon-library/lucide-1.59.0.json').then(response => { if (!response.ok) throw new Error('Icon library unavailable'); return response.json() }).then(data => { if (active) setIcons(data as Record<string, LibraryIcon>) }).catch(() => { if (active) setError('Could not load icons. Close and reopen the library to retry.') }); return () => { active = false } }, [])
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const entries = Object.entries(icons ?? {}).filter(([name, icon]) => words.every(word => `${name} ${icon.tags.join(' ')}`.includes(word)))
  return <div role="region" aria-label="Icon library" className="grid gap-3 rounded-lg border bg-white p-2">
    <p className="text-xs text-neutral-600">Free icons for personal and commercial websites. <a href="https://lucide.dev/license" target="_blank" rel="noreferrer" className="underline">Lucide license</a></p>
    <label className="grid gap-1 text-xs">Search icons<input type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(60) }} className="w-full rounded border p-2" placeholder="Search heart, phone, business…" /></label>
    <div className="flex flex-wrap gap-3 text-xs"><label className="grid gap-1">Icon color<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label><label className="grid gap-1">Icon size (px)<input type="number" min={16} max={256} value={size} onChange={event => setSize(Math.max(16,Math.min(256,Number(event.target.value)||16)))} className="w-20 rounded border p-1" /></label></div>
    {!icons && !error && <p role="status" className="text-xs">Loading icons…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {icons && <p role="status" className="text-xs">{entries.length} icons found. Select an icon to use it here.</p>}
    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-auto">{entries.slice(0,limit).map(([name,icon]) => <button type="button" key={name} aria-label={`Use ${name.replace(/-/g,' ')} icon`} title={name.replace(/-/g,' ')} className="grid min-w-0 justify-items-center gap-1 rounded border p-2 hover:bg-sky-50" onClick={() => onUse(iconImage(icon,color,size),`${name.replace(/-/g,' ')} icon`)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={iconImage(icon,color,32)} width={28} height={28} /><span className="w-full truncate text-[10px]">{name.replace(/-/g,' ')}</span>
    </button>)}</div>
    {entries.length>limit && <button type="button" className="rounded border p-2 text-xs" onClick={() => setLimit(value=>value+60)}>Show more icons</button>}
  </div>
}
