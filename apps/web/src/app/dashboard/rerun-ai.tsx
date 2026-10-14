'use client'
import { ErrorNotice } from '@/components/error-notice'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startGeneration } from '@/app/actions/projects'
import type { RerunRequest } from '@awb/shared/rerun-request'

export function RerunAi({ projectId, generating, built }: { projectId: string; generating: boolean; built: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const dialog = useRef<HTMLDialogElement>(null)
  const [scope, setScope] = useState<RerunRequest['scope']>(built ? 'CONTENT' : 'FULL')
  const [instruction, setInstruction] = useState('')
  const [logo, setLogo] = useState<File>()
  const [photos, setPhotos] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<Record<string, string>>({})

  async function upload(file: File, kind: 'LOGO' | 'IMAGE') {
    const key = `${kind}:${file.name}:${file.size}:${file.lastModified}`
    if (uploaded[key]) return uploaded[key]!
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose images of 5 MB or smaller.')
    const body = new FormData()
    body.set('projectId', projectId)
    body.set('kind', kind)
    body.set('preserveBrandColors', 'true')
    body.set('file', file)
    const response = await fetch('/api/assets', { method: 'POST', body })
    const payload = await response.json()
    if (!response.ok || !payload.asset?.id) throw new Error(payload.error || 'Upload failed. Please try again.')
    setUploaded(current => ({ ...current, [key]: payload.asset.id }))
    return payload.asset.id as string
  }

  async function rerun() {
    if (pending || generating) return
    setPending(true)
    setError(undefined)
    try {
      const imageAssetIds: string[] = []
      const logoAssetId = scope !== 'CONTENT' && logo ? await upload(logo, 'LOGO') : undefined
      if (scope !== 'CONTENT') for (const file of photos) imageAssetIds.push(await upload(file, 'IMAGE'))
      const { correlationId } = await startGeneration(projectId, { scope, instruction, imageAssetIds, ...(logoAssetId ? { logoAssetId } : {}) })
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
          {scope !== 'CONTENT' && <fieldset disabled={pending} className="grid gap-3 rounded-lg bg-neutral-50 p-3">
            <legend className="text-sm font-medium">Your assets {scope !== 'UPLOADS' && '(optional)'}</legend>
            <label className="grid gap-1 text-sm">Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setLogo(event.target.files?.[0])} /></label>
            <label className="grid gap-1 text-sm">Photos (up to 10)<input type="file" multiple accept="image/*" onChange={event => { const files = Array.from(event.target.files ?? []); setPhotos(files); setError(files.length > 10 ? 'Choose at most 10 photos.' : undefined) }} /></label>
            <p className="text-xs text-neutral-600">5 MB per file. Photos replace available image positions in page order. Use the editor for precise placement or logo-based colour suggestions.</p>
          </fieldset>}
          {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-sm text-red-700" />}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-md border px-3 py-2">Cancel</button>
            <button type="submit" disabled={pending || generating || scope !== 'CONTENT' && photos.length > 10 || scope === 'UPLOADS' && !logo && !photos.length} className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50">{pending ? 'Starting update…' : scope === 'UPLOADS' ? 'Apply uploads' : 'Run AI update'}</button>
          </div>
        </form>
      </dialog>
      {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="max-w-xs text-xs text-red-700" />}
    </div>
  )
}
