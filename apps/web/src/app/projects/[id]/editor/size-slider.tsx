'use client'

export function SizeSlider({ label, displayLabel, value, min, max, unit, valueText, onChange }: { label: string; displayLabel?: string; value: number; min: number; max: number; unit: string; valueText?: string; onChange: (value: number) => void }) {
  return <span className="grid min-w-0 w-full gap-2 py-1">
    <span className="flex items-center justify-between gap-4"><span>{displayLabel ?? label}</span><span className="text-neutral-500 tabular-nums">{valueText ?? `${Math.round(value)}${unit}`}</span></span>
    <input aria-label={label} aria-valuetext={valueText ?? `${Math.round(value)}${unit}`} type="range" min={min} max={max} step={1} value={Math.max(min, Math.min(max, value))} className="h-6 w-full cursor-pointer accent-violet-600" onChange={event => onChange(Number(event.target.value))} onKeyDown={event => event.stopPropagation()} />
  </span>
}
