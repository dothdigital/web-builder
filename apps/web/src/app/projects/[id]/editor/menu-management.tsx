'use client'

import { useState } from 'react'

type Link = { label: string; href: string; children?: Link[] }
type Column = { title: string; kind?: 'links' | 'address' | 'logo'; items: Link[] }
type Page = { title: string; path: string; navLabel?: string }
const control = 'w-full min-w-0 rounded border p-2 text-xs'

function Links({ items, pages, onChange, nested = false }: { items: Link[]; pages: Page[]; onChange: (items: Link[]) => void; nested?: boolean }) {
  const [page, setPage] = useState('')
  return <div className="grid gap-2">
    {items.map((item, index) => <details key={index} className="rounded border bg-white p-2"><summary className="cursor-pointer text-xs">{item.label || 'Untitled link'}</summary><div className="mt-2 grid gap-2">
      <label className="grid gap-1 text-xs">Link name<input className={control} value={item.label} onChange={e => onChange(items.map((entry, i) => i === index ? { ...entry, label: e.target.value } : entry))} /></label>
      <label className="grid gap-1 text-xs">Destination<input className={control} value={item.href} onChange={e => onChange(items.map((entry, i) => i === index ? { ...entry, href: e.target.value } : entry))} /></label>
      <div className="flex gap-3 text-xs"><button type="button" disabled={index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; onChange(next) }}>Move up</button><button type="button" disabled={index === items.length - 1} onClick={() => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1]!, next[index]!]; onChange(next) }}>Move down</button><button type="button" className="text-red-700" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove link</button></div>
      {!nested && <fieldset className="rounded border p-2"><legend className="text-xs">Dropdown links</legend><Links nested items={item.children ?? []} pages={pages} onChange={children => onChange(items.map((entry, i) => i === index ? { ...entry, children } : entry))} /></fieldset>}
    </div></details>)}
    <div className="flex gap-2"><select aria-label="Choose page to add" className={control} value={page} onChange={e => setPage(e.target.value)}><option value="">Choose a page…</option>{pages.map(entry => <option key={entry.path} value={entry.path}>{entry.navLabel || entry.title}</option>)}</select><button type="button" className="shrink-0 text-xs text-sky-700" disabled={!page} onClick={() => { const entry = pages.find(entry => entry.path === page); if (entry) onChange([...items, { label: entry.navLabel || entry.title, href: entry.path }]); setPage('') }}>Add page</button></div>
    <button type="button" className="text-left text-xs text-sky-700" onClick={() => onChange([...items, { label: 'New link', href: '/' }])}>+ Add custom link</button>
  </div>
}

export function MenuManagement({ footer, props, pages, onChange }: { footer: boolean; props: Record<string, unknown>; pages: Page[]; onChange: (path: string, value: unknown) => void }) {
  const savedColumns = (Array.isArray(props.columns) ? props.columns : []) as Column[]
  const columns: Column[] = props.layoutManaged ? savedColumns : [{ title: 'Logo', kind: 'logo', items: [] }, ...savedColumns, { title: 'Get in touch', kind: 'address', items: [] }]
  const saveColumns = (next: Column[]) => onChange('', { ...props, layoutManaged: true, columns: next })
  const update = (index: number, patch: Partial<Column>) => saveColumns(columns.map((column, i) => i === index ? { ...column, ...patch } : column))
  return <section className="grid gap-3 border-b p-4" aria-label={footer ? 'Footer menu management' : 'Header menu management'}>
    <h3 className="text-sm font-semibold">{footer ? 'Footer menu management' : 'Header menu management'}</h3>
    <p className="text-xs text-neutral-500">{footer ? 'Choose your columns and the links in each. Removing a link keeps its page.' : 'Choose and reorder the links shown in your header. Removing a link keeps its page.'}</p>
    {footer ? <>
      {!props.layoutManaged && <button type="button" className="rounded border p-2 text-xs text-sky-700" onClick={() => saveColumns(columns)}>Customize footer columns</button>}
      <label className="grid gap-1 text-xs">Number of columns<select className={control} value={columns.length} onChange={e => { const count = Number(e.target.value); saveColumns(Array.from({ length: count }, (_, index) => columns[index] ?? { title: `Column ${index + 1}`, kind: 'links', items: [] })) }}><option value={0}>0</option>{Array.from({ length: Math.max(6, columns.length) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      {columns.map((column, index) => <details key={index} className="rounded border p-2"><summary className="cursor-pointer text-xs font-medium">{index + 1}. {column.title || 'Untitled column'} ({column.kind || 'links'})</summary><div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs">Column name<input className={control} value={column.title} onChange={e => update(index, { title: e.target.value })} /></label>
        <label className="grid gap-1 text-xs">Column content<select className={control} value={column.kind || 'links'} onChange={e => update(index, { kind: e.target.value as Column['kind'] })}><option value="links">Menu links</option><option value="address">Address and contact details</option><option value="logo">Logo and business description</option></select></label>
        {(!column.kind || column.kind === 'links') && <Links nested items={column.items} pages={pages} onChange={items => update(index, { items })} />}
        {column.kind === 'address' && <p className="text-xs text-neutral-500">Uses your business address and contact details.</p>}
        {column.kind === 'logo' && <p className="text-xs text-neutral-500">Uses your footer logo, business name, and tagline.</p>}
        <div className="flex gap-3 text-xs"><button type="button" disabled={index === 0} onClick={() => { const next = [...columns]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; saveColumns(next) }}>Move left</button><button type="button" disabled={index === columns.length - 1} onClick={() => { const next = [...columns]; [next[index], next[index + 1]] = [next[index + 1]!, next[index]!]; saveColumns(next) }}>Move right</button><button type="button" className="text-red-700" onClick={() => saveColumns(columns.filter((_, i) => i !== index))}>Remove column</button></div>
      </div></details>)}
    </> : <Links items={(Array.isArray(props.items) ? props.items : []) as Link[]} pages={pages} onChange={items => onChange('/items', items)} />}
  </section>
}
