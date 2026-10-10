'use client'
import { imageStyleOptions, type ImageDirection } from '@awb/shared/image-direction'
export function ImageDirectionFields({ value, onChange, disabled }: { value: ImageDirection; onChange: (value: ImageDirection) => void; disabled?: boolean }) {
  const selected: readonly string[] = value.styles ?? (value.style === 'auto' ? [] : value.style === 'combination' ? ['people', 'local'] : [value.style])
  return <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3" disabled={disabled}>
    <legend className="px-1 text-sm font-medium">Generated image style</legend>
    <p className="text-xs text-neutral-500">Choose any combination. Leave all unchecked to let AI choose.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {imageStyleOptions.filter(([id]) => id !== 'auto' && id !== 'combination' ).map(([id, label]) => <label key={id} className="flex items-start gap-2 rounded-md border border-neutral-200 p-3 text-sm">
        <input type="checkbox" className="mt-0.5" checked={selected.includes(id)} onChange={event => onChange({ ...value, style: 'auto', styles: (event.target.checked ? [...selected, id] : selected.filter(style => style !== id)) as NonNullable<ImageDirection['styles']> })} />
        <span>{label}</span>
      </label>)}
    </div>
    <label className="grid gap-1 text-sm">Visual direction (optional)<textarea className="rounded border p-2" rows={2} maxLength={1500} value={value.notes} onChange={event => onChange({ ...value, notes: event.target.value })} placeholder="For example: diverse families in Canadian neighbourhoods, natural photography." /></label>
    <p className="text-xs text-neutral-500">Applies to newly generated website images. Uploaded photos and your saved logo are reused.</p>
  </fieldset>
}
