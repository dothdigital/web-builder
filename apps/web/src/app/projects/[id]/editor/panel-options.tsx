'use client'

import { useId } from 'react'

export function PanelOptions({ label, options, value, onChange, className }: { className?: string; label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  const name = useId()
  return <fieldset className={`grid content-start gap-2 ${className ?? ''}`}>
    <legend className="mb-2 text-xs font-medium text-neutral-500">{label}</legend>
    {options.map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${value === option.value ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-neutral-200 hover:bg-neutral-50'}`}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="accent-violet-600" />{option.label}
    </label>)}
  </fieldset>
}
