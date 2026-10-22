'use client'

export function mergeChipValues(existing: string[], value: string): string[] {
  return [...existing, ...value.split(/[,\n]/)].map(item => item.trim()).filter((item, index, all) => item && all.findIndex(other => other.toLocaleLowerCase() === item.toLocaleLowerCase()) === index)
}

export function ChipInput({ id, label, values, draft, onValuesChange, onDraftChange, placeholder }: {
  id: string
  label: string
  values: string[]
  draft: string
  onValuesChange: (values: string[]) => void
  onDraftChange: (value: string) => void
  placeholder: string
}) {
  function commit() {
    onValuesChange(mergeChipValues(values, draft))
    onDraftChange('')
  }

  return <div>
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 bg-white p-2 focus-within:ring-2 focus-within:ring-neutral-400">
      {values.map(value => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm">
        {value}
        <button type="button" aria-label={`Remove ${value} from ${label.toLowerCase()}`} className="rounded-full px-2 py-0.5 hover:bg-neutral-200 focus-visible:outline-2" onClick={() => onValuesChange(values.filter(item => item !== value))}>×</button>
      </span>)}
      <input id={id} className="min-w-32 flex-1 px-1 py-2 text-sm outline-none" value={draft} placeholder={placeholder} aria-describedby={`${id}-help`}
        onChange={event => {
          const value = event.target.value
          if (/[,\n]/.test(value) && !('isComposing' in event.nativeEvent && event.nativeEvent.isComposing)) {
            const parts = value.split(/[,\n]/)
            onValuesChange(mergeChipValues(values, parts.slice(0, -1).join(',')))
            onDraftChange(parts.at(-1) ?? '')
          } else onDraftChange(value)
        }}
        onKeyDown={event => {
          if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === ',')) {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
    </div>
    <p id={`${id}-help`} className="mt-1 text-xs text-neutral-500">Press Enter or comma to add. You can also paste a comma-separated list. Click × to remove.</p>
  </div>
}
