'use client'
import { UploadButton } from '@/components/upload-button'
import type { PaletteSuggestion } from '@awb/ai'
import { ImageDirectionFields } from '@/components/image-direction-fields'
import type { ImageDirection } from '@awb/shared/image-direction'
import { ErrorNotice } from '@/components/error-notice'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startGeneration } from '@/app/actions/projects'
import type { RerunRequest } from '@awb/shared/rerun-request'

export function RerunAi({ projectId, generating, built, initialImageDirection }: { projectId: string; generating: boolean; built: boolean; initialImageDirection?: ImageDirection }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const dialog = useRef<HTMLDialogElement>(null)
  const [scope, setScope] = useState<RerunRequest['scope']>(built ? 'CONTENT' : 'FULL')
  const [imageDirection, setImageDirection] = useState<ImageDirection>(initialImageDirection ?? { style: 'auto', styles: [], notes: '' })
  const [instruction, setInstruction] = useState('')
  const [logo, setLogo] = useState<File>()
  const [logoUploading, setLogoUploading] = useState(false)
  const [detectedColors, setDetectedColors] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<PaletteSuggestion[]>([])
  const [selectedPalette, setSelectedPalette] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<Record<string, string>>({})

  async function upload(file: File, kind: 'LOGO' | 'IMAGE', refreshSuggestions = false) {
    const key = `${kind}:${file.name}:${file.size}:${file.lastModified}`
    if (!refreshSuggestions && uploaded[key]) return uploaded[key]!
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose images of 5 MB or smaller.')
    const body = new FormData()
    body.set('projectId', projectId)
    body.set('kind', kind)
    body.set('preserveBrandColors', 'true')
    if (kind === 'LOGO') body.set('suggestBrandColors', 'true')
    body.set('file', file)
    const response = await fetch('/api/assets', { method: 'POST', body })
    const payload = await response.json()
    if (!response.ok || !payload.asset?.id) throw new Error(payload.error || 'Upload failed. Please try again.')
    if (kind === 'LOGO') { setDetectedColors((payload.colors ?? []).map((color: { hex: string }) => color.hex)); setSuggestions(payload.suggestions ?? []); setSelectedPalette(payload.suggestions?.[0]?.id ?? '') }
    setUploaded(current => ({ ...current, [key]: payload.asset.id }))
    return payload.asset.id as string
  }

  async function chooseLogo(file?: File) {
    setLogo(file)
    setSuggestions([])
    setDetectedColors([])
    setSelectedPalette('')
    if (!file) return
    setLogoUploading(true)
    setError(undefined)
    try { await upload(file, 'LOGO', true) }
    catch (caught) { setLogo(undefined); setError(caught instanceof Error ? caught.message : 'Logo upload failed.') }
    finally { setLogoUploading(false) }
  }

  async function rerun() {
    if (pending || generating || logoUploading) return
    setPending(true)
    setError(undefined)
    try {
      const imageAssetIds: string[] = []
      const logoAssetId = scope !== 'CONTENT' && logo ? await upload(logo, 'LOGO') : undefined
      if (scope !== 'CONTENT') for (const file of photos) imageAssetIds.push(await upload(file, 'IMAGE'))
      const palette = suggestions.find(item => item.id === selectedPalette)?.tokens.palette
      const { correlationId } = await startGeneration(projectId, { scope, instruction, imageAssetIds, ...(['IMAGES', 'FULL'].includes(scope) ? { imageDirection } : {}), ...(logoAssetId ? { logoAssetId, ...(palette ? { palette } : {}) } : {}) })
      dialog.current?.close()
      router.push(`/projects/${projectId}/progress?correlationId=${encodeURIComponent(correlationId)}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not restart generation. Please try again.')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => { setError(undefined); dialog.current?.showModal() }}
        disabled={pending || generating}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
        title="Choose what to update and tell AI what should change."
      >
        {pending ? 'Starting AI…' : generating ? 'AI running…' : 'Rerun with AI'}
      </button>
      <dialog ref={dialog} aria-label="Rerun with AI" onCancel={event => { if (pending) event.preventDefault() }} className="m-auto w-[min(92vw,36rem)] max-h-[90vh] overflow-auto rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-xl backdrop:bg-black/40">
        <h2 className="text-xl font-semibold">What would you like to change?</h2>
        <p className="mt-2 text-sm text-neutral-600">Start from your saved website and create a new draft. Save any editor changes first.</p>
        <form className="mt-5 grid gap-4" onSubmit={event => { event.preventDefault(); void rerun() }}>
          <fieldset disabled={pending} className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Update</legend>
            {([
              ['CONTENT', 'Content only', 'Rewrite headings, text and SEO. Keep images, colours and layout.'],
              ['IMAGES', 'Images only', 'Replace up to 10 website images. Keep the content and design.'],
              ['FULL', 'Full website', 'Rebuild the website from your brief and these instructions.'],
              ['UPLOADS', 'Upload logo or photos', 'Use your uploaded assets without generating new text or images.'],
            ] as const).map(([value, label, help]) => <label key={value} className={`flex gap-3 rounded-lg border p-3 ${scope === value ? 'border-neutral-900' : 'border-neutral-200'}`}>
              <input type="radio" name={`rerun-scope-${projectId}`} value={value} checked={scope === value} disabled={!built && value !== 'FULL'} onChange={() => setScope(value)} />
              <span><strong className="block text-sm">{label}</strong><span className="text-xs text-neutral-500">{help}</span></span>
            </label>)}
          </fieldset>
          <label className="grid gap-2 text-sm font-medium">{scope === 'UPLOADS' ? 'Notes about your uploads (optional)' : 'What should AI do?'}
            <textarea autoFocus required={scope !== 'UPLOADS'} maxLength={4000} rows={4} disabled={pending} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder={scope === 'IMAGES' ? 'For example: use natural photographs of modern offices with warm lighting.' : scope === 'CONTENT' ? 'For example: make the copy shorter and focus on our home renovation services.' : 'Describe the changes you want.'} className="rounded-md border border-neutral-300 p-3 font-normal" />
          </label>
          {['IMAGES', 'FULL'].includes(scope) && <ImageDirectionFields value={imageDirection} onChange={setImageDirection} disabled={pending} />}
          {scope !== 'CONTENT' && <fieldset disabled={pending} className="grid gap-3 rounded-lg bg-neutral-50 p-3">
            <legend className="text-sm font-medium">Your assets {scope !== 'UPLOADS' && '(optional)'}</legend>
            <div className="grid gap-1 text-sm"><span>Logo</span><UploadButton label="Upload logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={logoUploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void chooseLogo(file) }} />{logo && <span className="break-all text-xs text-neutral-600">{logo.name}</span>}</div>
            {logoUploading && <p role="status" className="text-sm">Finding the best colours from your logo…</p>}
            {detectedColors.length > 0 && <div className="grid gap-2"><p className="text-xs font-semibold">Detected logo colours</p><div className="flex flex-wrap gap-2">{detectedColors.map(color => <span key={color} className="flex items-center gap-1 text-xs"><span className="h-5 w-5 rounded border" style={{ backgroundColor: color }} />{color}</span>)}</div></div>}
            {suggestions.length > 0 && <div className="grid gap-3">
              <p className="text-sm font-semibold">Choose your website colours</p>
              <p className="text-xs text-neutral-600">Your selected colours will apply across every page when you continue.</p>
              {built && <label className={`flex items-center gap-2 rounded border p-3 text-xs ${selectedPalette === '' ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200'}`}><input type="radio" name={`rerun-palette-${projectId}`} checked={selectedPalette === ''} onChange={() => setSelectedPalette('')} />Keep current colours</label>}
              {suggestions.map((suggestion, index) => <label key={suggestion.id} className={`grid gap-2 rounded border p-3 text-xs ${selectedPalette === suggestion.id ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200'}`} style={{ backgroundColor: suggestion.tokens.palette.background, color: suggestion.tokens.palette.foreground }}>
                <span><input type="radio" name={`rerun-palette-${projectId}`} checked={selectedPalette === suggestion.id} onChange={() => setSelectedPalette(suggestion.id)} /> {suggestion.label}{index === 0 && ' · Recommended'}</span>
                <span>{suggestion.rationale}</span>
                <span className="flex gap-1">{Object.entries(suggestion.tokens.palette).map(([role, color]) => <span key={role} title={`${role}: ${color}`} className="h-5 w-5 rounded border" style={{ backgroundColor: color }} />)}</span>
              </label>)}
            </div>}
            <div className="grid gap-1 text-sm"><span>Photos (up to 10)</span><UploadButton label="Upload images" multiple onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (!files.length) return; setPhotos(files); setError(files.length > 10 ? 'Choose at most 10 photos.' : undefined) }} />{photos.length > 0 && <span className="text-xs text-neutral-600">{photos.length} image{photos.length === 1 ? '' : 's'} selected</span>}</div>
            <p className="text-xs text-neutral-600">5 MB per file. Photos replace available image positions in page order. Choose a colour option above to use with your logo.</p>
          </fieldset>}
          {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-sm text-red-700" />}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={pending || logoUploading} onClick={() => dialog.current?.close()} className="rounded-md border px-3 py-2">Cancel</button>
            <button type="submit" disabled={pending || generating || logoUploading || scope !== 'CONTENT' && photos.length > 10 || scope === 'UPLOADS' && !logo && !photos.length} className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50">{pending ? 'Starting update…' : scope === 'UPLOADS' ? 'Apply uploads' : scope === 'FULL' ? 'Rebuild website' : 'Run AI update'}</button>
          </div>
        </form>
      </dialog>
      {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="max-w-xs text-xs text-red-700" />}
    </div>
  )
}
