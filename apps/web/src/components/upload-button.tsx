'use client'
import { useRef, type ChangeEventHandler } from 'react'

export function UploadButton({ label = 'Upload image', inputLabel, accept = 'image/*', multiple, disabled, onChange, className, describedBy }: {
  label?: string
  inputLabel?: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  className?: string
  describedBy?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return <div className="grid min-w-0 gap-2">
    <button type="button" aria-label={label} aria-describedby={describedBy} disabled={disabled} className={className ?? 'rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'} onClick={() => input.current?.click()}>{label}</button>
    <input ref={input} type="file" aria-label={inputLabel ?? `${label} file`} accept={accept} multiple={multiple} disabled={disabled} hidden onChange={onChange} />
  </div>
}
