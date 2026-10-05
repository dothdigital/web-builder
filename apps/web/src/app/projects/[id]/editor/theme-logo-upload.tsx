'use client'
import { ErrorNotice } from '@/components/error-notice'

import { useState } from 'react'
import type { PaletteSuggestion } from '@awb/ai'
import type { DesignTokens } from '@awb/website-model'

export function ThemeLogoUpload({ projectId, logoUrl, onUpload, onApplyPalette }: {
  projectId: string
  logoUrl?: string
  onUpload: (url: string) => void
  onApplyPalette: (tokens: DesignTokens) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()
  const [uploaded, setUploaded] = useState(false)
  const [suggestions, setSuggestions] = useState<PaletteSuggestion[]>([])
  const [selected, setSelected] = useState('')
  const [applied, setApplied] = useState(false)

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('Choose an image under 5 MB.'); return }
    setUploading(true)
    setError(undefined)
    setUploaded(false)
    setSuggestions([])
    setApplied(false)
    try {
      const body = new FormData()
      body.set('projectId', projectId)
      body.set('kind', 'LOGO')
      body.set('preserveBrandColors', 'true')
      body.set('suggestBrandColors', 'true')
      body.set('file', file)
      const response = await fetch('/api/assets', { method: 'POST', body })
      const payload = await response.json()
      if (!response.ok || typeof payload.asset?.url !== 'string') throw new Error(payload.error || 'Logo upload failed. Please try again.')
      onUpload(payload.asset.url)
      setSuggestions(payload.suggestions ?? [])
      setSelected(payload.suggestions?.[0]?.id ?? '')
      setUploaded(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Logo upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3">
    <legend className="px-1 text-sm font-semibold">Website logo</legend>
    <p className="text-xs text-neutral-500">Upload or replace your logo for every page. Choose a suggested colour combination below and apply it when ready.</p>
    {logoUrl && <div className="rounded border bg-neutral-100 p-3"><img src={`/api/projects/${projectId}/editor-image?url=${encodeURIComponent(logoUrl)}`} alt="Current website logo" className="mx-auto h-16 max-w-full object-contain" /></div>}
    <label className="grid gap-2 text-xs font-medium">{uploading ? 'Uploading logo…' : logoUrl ? 'Replace logo' : 'Upload logo'}
      <input aria-label="Upload website logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} className="max-w-full text-xs" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
    </label>
    <p className="text-xs text-neutral-500">PNG, JPG, WebP or SVG · up to 5 MB. Save your changes to show the logo in Preview.</p>
    {uploaded && <p role="status" className="text-xs text-emerald-700">Logo uploaded. Save to update Preview.</p>}
    {suggestions.length > 0 && <div className="grid gap-3">
      <p className="text-sm font-semibold">Suggested colour combinations</p>
      {suggestions.map(suggestion => <label key={suggestion.id} className="grid gap-2 rounded border p-3 text-xs" style={{ backgroundColor: suggestion.tokens.palette.background, color: suggestion.tokens.palette.foreground, borderColor: suggestion.tokens.palette.border }}>
        <span className="flex items-center gap-2"><input type="radio" name="logo-palette" value={suggestion.id} checked={selected === suggestion.id} onChange={() => { setSelected(suggestion.id); setApplied(false) }} />{suggestion.label}</span>
        <span>{suggestion.rationale}</span>
        <span className="flex gap-1">{Object.entries(suggestion.tokens.palette).map(([role, color]) => <span key={role} title={`${role}: ${color}`} className="h-5 w-5 rounded border" style={{ backgroundColor: color }} />)}</span>
      </label>)}
      <p className="text-xs text-neutral-500">Applies across all pages, including custom section, text and button colours. Content, layout and images are kept. You can Undo this change.</p>
      <button type="button" disabled={uploading || !selected} className="rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => { const suggestion = suggestions.find(item => item.id === selected); if (suggestion) { onApplyPalette(suggestion.tokens); setApplied(true) } }}>Apply colours to entire site</button>
      {applied && <p role="status" className="text-xs text-emerald-700">Colours applied to every page. Save to update Preview.</p>}
    </div>}
    {error && <ErrorNotice code="WT-UPLOAD-001" message={error} className="text-xs text-red-700" />}
  </fieldset>
}
