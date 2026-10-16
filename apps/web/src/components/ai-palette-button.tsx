'use client'
import { useState } from 'react'
import type { PaletteSuggestion } from '@awb/ai'
import { ErrorNotice } from './error-notice'

export function AiPaletteButton({ projectId, logoColors, disabled, onBusyChange, onChoose }: {
  projectId: string; logoColors: string[]; disabled?: boolean
  onBusyChange: (busy: boolean) => void; onChoose: (suggestion: PaletteSuggestion) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  async function choose() {
    setBusy(true); onBusyChange(true); setError(undefined)
    try {
      let colors = logoColors
      if (!colors.length) {
        const detected = await fetch(`/api/projects/${projectId}/logo-colors`)
        const payload = await detected.json()
        if (!detected.ok) throw new Error(payload.error || 'Could not read logo colours.')
        colors = (payload.colors ?? []).map((color: { hex: string }) => color.hex)
      }
      const response = await fetch(`/api/projects/${projectId}/ai-logo-colors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoColors: colors }) })
      const payload = await response.json()
      if (!response.ok || !payload.suggestion?.tokens?.palette) throw new Error(payload.error || 'AI could not choose colours. Please try again.')
      onChoose(payload.suggestion)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'AI could not choose colours. Please try again.') }
    finally { setBusy(false); onBusyChange(false) }
  }
  return <div className="grid gap-2">
    <button type="button" disabled={disabled || busy} className="rounded border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 disabled:opacity-50" onClick={() => void choose()}>{busy ? 'AI is choosing colours…' : 'Let AI choose colours'}</button>
    <p className="text-xs text-neutral-500">AI chooses a palette using your logo and business. Review the colours, then Apply when ready.</p>
    {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-xs text-red-700" />}
  </div>
}
