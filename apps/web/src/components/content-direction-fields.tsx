'use client'
import { contentStyleOptions, type ContentDirection } from '@awb/shared/content-direction'
export function ContentDirectionFields({value,onChange,disabled}:{value:ContentDirection;onChange:(value:ContentDirection)=>void;disabled?:boolean}) {
  const selected: readonly string[] = value.styles ?? (value.style === 'auto' ? [] : [value.style])
 return <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3" disabled={disabled}><legend className="px-1 text-sm font-medium">Website content direction</legend>
    <p className="text-xs text-neutral-500">Choose any combination. Leave all unchecked to let AI choose.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {contentStyleOptions.filter(([id]) => id !== 'auto' ).map(([id, label]) => <label key={id} className="flex items-start gap-2 rounded-md border border-neutral-200 p-3 text-sm">
        <input type="checkbox" className="mt-0.5" checked={selected.includes(id)} onChange={event => onChange({ ...value, style: 'auto', styles: (event.target.checked ? [...selected, id] : selected.filter(style => style !== id)) as NonNullable<ContentDirection['styles']> })} />
        <span>{label}</span>
      </label>)}
    </div>
 <label className="grid gap-1 text-sm">Who are you writing for?<input className="rounded border p-2" maxLength={500} value={value.audience} onChange={e=>onChange({...value,audience:e.target.value})} placeholder="For example: Canadian families and first-time insurance buyers" /></label>
 <label className="grid gap-1 text-sm">Writing preferences (optional)<textarea className="rounded border p-2" rows={3} maxLength={1500} value={value.notes} onChange={e=>onChange({...value,notes:e.target.value})} placeholder="Key messages, wording to avoid, preferred detail, language or calls to action" /></label></fieldset>
}
