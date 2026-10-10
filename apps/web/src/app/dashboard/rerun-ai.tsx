'use client'
import { ErrorNotice } from '@/components/error-notice'

import { ImageDirectionFields } from '@/components/image-direction-fields'
import { ContentDirectionFields } from '@/components/content-direction-fields'
import type { ContentDirection, GenerationOptions, ImageDirection } from '@awb/shared'
import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startGeneration } from '@/app/actions/projects'

export function RerunAi({ projectId, generating }: { projectId: string; generating: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<GenerationOptions['mode']>('fill-images')
  const [contentDirection, setContentDirection] = useState<ContentDirection>({ style: 'auto', audience: '', notes: '' })
  const [imageDirection, setImageDirection] = useState<ImageDirection>({ style: 'auto', notes: '' })
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function rerun() {
    if (pending || generating) return
    setPending(true)
    setError(undefined)
    try {
      const { correlationId } = await startGeneration(projectId, { mode, imageDirection, contentDirection })
      router.push(`/projects/${projectId}/progress?correlationId=${encodeURIComponent(correlationId)}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not restart generation. Please try again.')
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(undefined); dialog.current?.showModal() }}
        disabled={pending || generating}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="dialog"
      >
        {pending ? 'Starting AI…' : generating ? 'AI running…' : 'Rerun with AI'}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/50"
        onCancel={event => { if (pending) event.preventDefault() }}
      >
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold">Rerun with AI</h2>
          <button type="button" aria-label="Close rerun popup" disabled={pending} onClick={() => dialog.current?.close()} className="rounded px-2 py-1 text-2xl leading-none hover:bg-neutral-100 disabled:opacity-50">×</button>
        </header>
        <div className="grid gap-4 p-6">
          <label className="grid gap-1 text-sm">
            What should rerun change?
            <select autoFocus className="rounded border p-2" value={mode} disabled={pending || generating} onChange={event => setMode(event.target.value as GenerationOptions['mode'])}>
              <option value="content">Content only — keep layout and images</option>
              <option value="fill-images">Fill missing images — keep existing images, content and layout</option>
              <option value="images">Generated images only — keep content and layout</option>
              <option value="content-images">Content and images — keep layout</option>
              <option value="full">Full rebuild — recreate content and layout</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-neutral-600">Creates a new draft. Previous drafts stay available. Uploaded photos and the saved logo are preserved. A full rebuild replaces manual layout and copy edits.</p>
          {mode !== 'content' && <ImageDirectionFields value={imageDirection} onChange={setImageDirection} disabled={pending || generating} />}
          {!['images', 'fill-images'].includes(mode) && <ContentDirectionFields value={contentDirection} onChange={setContentDirection} disabled={pending || generating} />}
          {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-xs" />}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-neutral-200 bg-white px-6 py-4">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void rerun()} disabled={pending || generating} className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? 'Starting AI…' : 'Start selected rerun'}</button>
        </footer>
      </dialog>
    </>
  )
}
