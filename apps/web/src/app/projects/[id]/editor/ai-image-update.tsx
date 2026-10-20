'use client'
import { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditorImageTargetContext } from '@/lib/editor-image-update'
import { EditorImageProgress } from '@/components/editor-image-progress'
import { ImageDirectionFields } from '@/components/image-direction-fields'
import { ErrorNotice } from '@/components/error-notice'
import type { ImageDirection } from '@awb/shared/image-direction'
import { createBlogCover, readContentResult } from '@/app/actions/content-jobs'

export function AiImageUpdate({ projectId, context = '', onUse, imagePointer, originalUrl = '' }: { imagePointer?: string; originalUrl?: string; projectId: string; context?: string; onUse: (url: string, alt: string) => void }) {
 const getTarget = useContext(EditorImageTargetContext)
 const [targetedJob, setTargetedJob] = useState(false)
 const [applied, setApplied] = useState(false)
 const router = useRouter()
 const [instruction, setInstruction] = useState('')
 const [transparent, setTransparent] = useState(false)
 const [direction, setDirection] = useState<ImageDirection>({ style: 'auto', styles: [], notes: '' })
 const [busy, setBusy] = useState(false)
 const [jobId, setJobId] = useState<string>()
 const [error, setError] = useState('')
 useEffect(() => {
  if (!jobId || targetedJob) return
  let cancelled = false, polling = false
  const controller = new AbortController()
  const poll = async () => {
   if (polling || document.hidden) return
   polling = true
   try {
    const response = await fetch(`/api/content-jobs?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal })
    if (!response.ok) return
    const payload = await response.json() as { jobs: Array<{ id: string; status: string }> }
    const job = payload.jobs.find(job => job.id === jobId)
    if (job?.status === 'READY') {
     const completed = await readContentResult(jobId)
     if (cancelled) return
     const image = completed.result as { url: string; alt: string }
     if (!image?.url || typeof image.url !== 'string') throw new Error('Invalid image result')
     onUse(image.url, image.alt); setApplied(true); setJobId(undefined); router.refresh()
    } else if (job?.status === 'FAILED' && !cancelled) { setError('Image generation failed. Please try again.'); setJobId(undefined) }
   } catch { /* Retry temporary failures without changing the selected image. */ }
   finally { polling = false }
  }
  void poll()
  const timer = setInterval(() => { void poll() }, 5000)
  return () => { cancelled = true; controller.abort(); clearInterval(timer) }
 }, [jobId, projectId, router, targetedJob, onUse])
 useEffect(() => {
  const applied = (event: Event) => { if ((event as CustomEvent<{ jobId: string }>).detail.jobId === jobId) { setApplied(true); setJobId(undefined); router.refresh() } }
  const failed = (event: Event) => { if ((event as CustomEvent<{ jobId: string }>).detail.jobId === jobId) { setJobId(undefined); setError((event as CustomEvent<{ message?: string }>).detail.message || 'Image generation failed. Please try again.') } }
  window.addEventListener('awb-editor-image-failed', failed)
  window.addEventListener('awb-editor-image-applied', applied)
  return () => { window.removeEventListener('awb-editor-image-applied', applied); window.removeEventListener('awb-editor-image-failed', failed) }
 }, [jobId, router])
 return <><EditorImageProgress visible={busy || !!jobId} /><div className="grid gap-3 rounded-lg border border-violet-200 bg-white p-3 text-xs">
  <label className="grid gap-1">What should the image show?<textarea rows={3} maxLength={1000} value={instruction} disabled={busy || !!jobId} onChange={event => setInstruction(event.target.value)} placeholder="Describe the subject and changes you want for this image." className="rounded border p-2" /></label>
  <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} disabled={busy || !!jobId} onChange={event => setTransparent(event.target.checked)} />Transparent background (PNG)</label>
  <ImageDirectionFields help="Applies to the new image for this position." value={direction} onChange={setDirection} disabled={busy || !!jobId} />
  <p className="text-neutral-500">Generate a new image for this position. The new image replaces this image automatically when ready. Your original stays in the library.</p>
  <button type="button" disabled={busy || !!jobId || instruction.trim().length < 10} className="rounded bg-violet-700 px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
   setBusy(true); setError(''); setApplied(false)
   try {
    const target = imagePointer ? getTarget?.(imagePointer, originalUrl) : undefined
    const job = await createBlogCover(projectId, { purpose: 'website', background: transparent ? 'transparent' : 'auto', ...(target ? { editorTarget: target } : {}), topic: instruction.trim().slice(0, 200), details: context.slice(0, 8000), direction: instruction, imageDirection: direction, requestId: crypto.randomUUID() })
    setTargetedJob(!!target); setJobId(job.jobId); window.dispatchEvent(new Event('awb-content-queued'))
   } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not start image generation.') }
   finally { setBusy(false) }
  }}>{busy ? 'Queuing…' : jobId ? 'Generating in background…' : applied ? 'Generate another image' : 'Generate image with AI'}</button>
  {jobId && <p role="status">Please keep this page open. Your image will be placed in this position when ready. Save afterward to keep the change.</p>}
  {applied && <p role="status">Image replaced. Save the website to keep this change.</p>}
  {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-red-700" />}
 </div></>
}
