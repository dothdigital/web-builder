'use client'

const sides = ['Top', 'Right', 'Bottom', 'Left'] as const

export function SpacingControls({ elements, appearances, onChange }: { elements: (HTMLElement | null)[]; appearances: Record<string, unknown>[]; onChange: (patch: Record<string, unknown>) => void }) {
  return <div className="grid gap-3">
    <p className="text-neutral-500">Padding adds space inside; margin adds space outside. Values are in pixels{elements.length > 1 ? ' and apply to every selected object' : ''}.</p>
    {(['padding', 'margin'] as const).map((kind) => <fieldset key={kind}>
      <legend className="mb-1 font-semibold">{kind === 'padding' ? 'Padding' : 'Margin'} (px)</legend>
      <div className="grid grid-cols-4 gap-2">{sides.map((side) => {
        const key = `${kind}${side}` as const
        const values = elements.map((element, index) => {
          const visual = element?.hasAttribute('data-awb-free-item') ? element.querySelector<HTMLElement>('[data-awb-element]') ?? element : element
          return appearances[index]?.[key] ?? (visual ? getComputedStyle(visual)[key] : undefined)
        }).map((value) => { const number = parseFloat(String(value)); return Number.isFinite(number) ? number : undefined })
        const common = values.every((value) => value === values[0]) ? values[0] : undefined
        return <label key={key} className="grid gap-1">{side}<input aria-label={`${kind} ${side.toLowerCase()}`} className="w-full min-w-0 rounded border p-1.5" type="number" min={0} max={400} step={1} value={common ?? ''} placeholder="Mixed / auto" onChange={(event) => {
          if (!event.target.value) return
          const value = Number(event.target.value)
          if (Number.isFinite(value) && value >= 0 && value <= 400) onChange({ [key]: value })
        }} /></label>
      })}</div>
      <button type="button" className="mt-1 text-sky-700 underline" onClick={() => onChange(Object.fromEntries(sides.map((side) => [`${kind}${side}`, undefined])))}>Use original {kind}</button>
    </fieldset>)}
  </div>
}
