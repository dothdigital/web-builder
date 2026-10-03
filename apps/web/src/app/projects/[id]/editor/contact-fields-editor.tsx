'use client'

import { useState } from 'react'

const fieldTypes = [['text','Text'],['textarea','Long text'],['number','Number'],['email','Email'],['tel','Phone'],['select','Dropdown'],['checkbox','Checkbox / consent'],['radio','Radio choices']]

type Field = { name: string; label: string; type: string; required?: boolean; options?: string[]; labelFontSize?: number; labelCase?: string; linkText?: string; linkUrl?: string; labelLinks?: Array<{ text: string; url: string }> }
export function ContactFieldsEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const fields = (Array.isArray(value) ? value : []) as Field[]
  const update = (index: number, patch: Partial<Field>) => onChange(fields.map((field, i) => i === index ? { ...field, ...patch } : field))
  return <fieldset className="grid gap-3"><legend className="mb-2 text-sm font-semibold">Contact form fields ({fields.length})</legend><p className="text-xs text-neutral-500">Each row is a field on your form. Click its name to edit it, or add a new field below.</p>
    {fields.map((field, index) => <div key={index} className="grid gap-2 rounded border p-3 text-xs">
      <button type="button" aria-expanded={expanded === index} className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setExpanded(expanded === index ? null : index)}><span className="min-w-0"><span className="block break-words font-semibold">{field.label || `Unnamed field ${index + 1}`}</span><span className="mt-1 block text-neutral-500">{fieldTypes.find(([type]) => type === field.type)?.[1] ?? field.type} · {field.required ? 'Required' : 'Optional'}</span></span><span aria-hidden="true">{expanded === index ? '−' : '+'}</span></button>
      {expanded === index && <div className="mt-2 grid gap-3 border-t pt-3">
      <label className="grid gap-1">{field.type === 'checkbox' ? 'Checkbox label / disclaimer' : 'Field label'}<input className="rounded border p-2" value={field.label} onChange={event => update(index, { label: event.target.value })} /></label>
      <label className="grid gap-1">Label font size (px)<input type="number" min={10} max={80} className="rounded border p-2" placeholder="Theme default" value={field.labelFontSize ?? ''} onChange={event => { const size = Number(event.target.value); if (!event.target.value) update(index, { labelFontSize: undefined }); else if (size >= 10 && size <= 80) update(index, { labelFontSize: size }) }} /></label>
      <label className="grid gap-1">Capitalization<select className="rounded border p-2" value={field.labelCase ?? 'none'} onChange={event => update(index, { labelCase: event.target.value })}><option value="none">As typed</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize Words</option></select></label>
      <details><summary className="cursor-pointer text-sky-700">Links within label</summary><p className="mt-2 text-neutral-500">Add a link for each phrase, such as Privacy Policy and Terms. Use distinct, non-overlapping words appearing in the label.</p>
        {(field.labelLinks ?? (field.linkText ? [{ text: field.linkText, url: field.linkUrl ?? '' }] : [])).map((link, linkIndex, links) => <div key={linkIndex} className="mt-2 grid gap-2 rounded border p-2">
          <label className="grid gap-1">Words to link<input className="rounded border p-2" value={link.text} onChange={event => update(index, { labelLinks: links.map((item, i) => i === linkIndex ? { ...item, text: event.target.value } : item) })} /></label>
          <label className="grid gap-1">Link address<input className="rounded border p-2" placeholder="/privacy or https://example.com/privacy" value={link.url} onChange={event => update(index, { labelLinks: links.map((item, i) => i === linkIndex ? { ...item, url: event.target.value } : item) })} /></label>
          {link.text && !field.label.includes(link.text) && <p className="text-amber-700">These words must appear in the label above.</p>}
          <button type="button" className="text-left text-red-700" onClick={() => update(index, { labelLinks: links.filter((_, i) => i !== linkIndex) })}>Remove link</button>
        </div>)}
        <button type="button" className="mt-2 rounded border p-2 disabled:opacity-40" disabled={(field.labelLinks?.length ?? 0) >= 10} onClick={() => update(index, { labelLinks: [...(field.labelLinks ?? (field.linkText ? [{ text: field.linkText, url: field.linkUrl ?? '' }] : [])), { text: '', url: '' }] })}>+ Add label link</button>
      </details>
      <label className="grid gap-1">Field type<select className="rounded border p-2" value={field.type} onChange={event => update(index, { type: event.target.value })}>{fieldTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {['select', 'radio'].includes(field.type) && <label className="grid gap-1">Choices (one per line)<textarea className="rounded border p-2" rows={4} value={(field.options ?? []).join('\n')} onChange={event => update(index, { options: event.target.value.split('\n') })} /></label>}
      <details><summary className="cursor-pointer text-neutral-500">Advanced: CRM field mapping</summary><label className="mt-2 grid gap-1">Submission field name<input className="rounded border p-2" value={field.name} onChange={event => { const name = event.target.value.replace(/[^a-zA-Z0-9_]/g, '_'); if (name && !['projectId', 'g_recaptcha_response'].includes(name) && !fields.some((other, i) => i !== index && other.name === name)) update(index, { name }) }} /></label></details>
      <label className="flex items-center gap-2"><input type="checkbox" checked={field.required ?? false} onChange={event => update(index, { required: event.target.checked })} />Required — visitor must fill this field</label>
      <div className="flex gap-3"><button type="button" disabled={index === 0} className="text-sky-700 disabled:opacity-40" onClick={() => { const next = [...fields]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; setExpanded(index - 1); onChange(next) }}>Move up</button><button type="button" className="text-red-700" onClick={() => { setExpanded(null); onChange(fields.filter((_, i) => i !== index)) }}>Remove field</button></div>
      </div>}
    </div>)}
    <button type="button" className="rounded border p-2" onClick={() => { setExpanded(fields.length); onChange([...fields, { name: `field_${crypto.randomUUID().replaceAll('-', '')}`, label: 'New field', type: 'text', required: false, options: [] }]) }}>+ Add form field</button>
  </fieldset>
}
