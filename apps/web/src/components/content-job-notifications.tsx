'use client'
import { EditorImageProgress } from './editor-image-progress'
import { ErrorNotice } from '@/components/error-notice'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { readContentResult, dismissContentJob, retryContentJob } from '@/app/actions/content-jobs'
export type ContentResult = Awaited<ReturnType<typeof readContentResult>>
type Job = { id: string; projectId: string; title: string; kind: string; status: string; error?: string }
function copy(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(copy).filter(Boolean).join('\n\n')
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => ['page', 'title', 'heading', 'intro', 'body', 'sections', 'props', 'blocks', 'items', 'question', 'answer', 'description', 'reason'].includes(key)).map(([, entry]) => copy(entry)).filter(Boolean).join('\n\n')
  return ''
}
export function ContentJobNotifications({ projectId, onApply }: { projectId?: string; onApply?: (detail: ContentResult) => void }) {
  const [allJobs, setJobs] = useState<Job[]>([])
  const [review, setReview] = useState<ContentResult>()
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [busy, setBusy] = useState<string>()
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (document.hidden) return
    try { const response = await fetch(`/api/content-jobs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, { signal }); if (response.ok) setJobs((await response.json()).jobs) } catch { /* Next poll recovers transient failures. */ }
  }, [projectId])
  useEffect(() => {
    const controller = new AbortController()
    const update = () => { void refresh(controller.signal) }
    update()
    const timer = setInterval(update, 15000 + Math.random() * 3000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('awb-content-queued', update)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('awb-content-queued', update) }
  }, [refresh])
  const act = async (id: string, action: () => Promise<unknown>) => { setHasError(false); setBusy(id); setMessage(''); try { await action(); await refresh() } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : 'Could not update request') } finally { setBusy(undefined) } }
  const processedImages = useRef(new Set<string>())
  const applyRef = useRef(onApply)
  applyRef.current = onApply
  const mounted = useRef(true)
  const [applyingImages, setApplyingImages] = useState(0)
  const [appliedImages, setAppliedImages] = useState<string[]>([])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!applyRef.current) return
    for (const job of allJobs.filter(job => job.status === 'FAILED' && job.title.startsWith('Image update:'))) window.dispatchEvent(new CustomEvent('awb-editor-image-failed', { detail: { jobId: job.id, message: job.error || 'Image generation failed. Please retry.' } }))
    for (const job of allJobs.filter(job => job.status === 'READY' && job.kind === 'COVER' && job.title.startsWith('Image update:'))) {
      if (processedImages.current.has(job.id)) continue
      processedImages.current.add(job.id)
      setApplyingImages(count => count + 1)
      void readContentResult(job.id).then(detail => {
        if (!mounted.current || !detail.editorTarget) return
        applyRef.current?.(detail)
        setAppliedImages(ids => [...ids, job.id])
        setHasError(false); setMessage('Image replaced in your editor. Save to keep this change.')
        window.dispatchEvent(new CustomEvent('awb-editor-image-applied', { detail: { jobId: job.id } }))
      }).catch(error => { if (mounted.current) { setHasError(true); setMessage(error instanceof Error ? error.message : 'Could not update this image.'); window.dispatchEvent(new CustomEvent('awb-editor-image-failed', { detail: { jobId: job.id, message: error instanceof Error ? error.message : 'Could not replace this image.' } })) } }).finally(() => { if (mounted.current) setApplyingImages(count => count - 1) })
    }
  }, [allJobs, !!onApply])
  const jobs = allJobs.filter(job => !appliedImages.includes(job.id))
  if (!jobs.length && !message) return null
  const ready = jobs.filter((job) => job.status === 'READY').length
  const websiteOnly = jobs.every((job) => job.kind === 'WEBSITE')
  const hasWebsite = jobs.some((job) => job.kind === 'WEBSITE')
  const hasContent = jobs.some((job) => !['WEBSITE', 'COVER'].includes(job.kind) && !job.title.startsWith('AI Assistant:'))
  const primaryAction = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-50'
  const secondaryAction = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-wait disabled:opacity-50'
  return <><EditorImageProgress visible={!!onApply && (applyingImages > 0 || allJobs.some(job => ['QUEUED', 'RUNNING'].includes(job.status) && job.title.startsWith('Image update:')))} /><div className="shrink-0 border-b-2 border-violet-300 bg-violet-50 px-4 py-5 text-sm shadow-sm sm:px-6">
    <details open={!!review || ready > 0}><summary className="cursor-pointer rounded text-lg font-bold text-violet-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">{ready ? `${websiteOnly ? 'Website ready' : 'Ready to review'} — ${ready} request${ready > 1 ? 's' : ''}` : `AI background requests (${jobs.length})`}</summary>
      <div className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
        {hasWebsite && <p>Completed website drafts are already saved. Click <strong>Preview website</strong> to review the saved draft in a new tab. Make changes in the editor, then Save to update Preview.</p>}
        {hasContent && <p>{onApply ? <>Click <strong>Review</strong>, add the generated content to your editor draft, then <strong>Save</strong> to show it in Preview.</> : <>Open the editor to review generated content, add it to your draft, then Save to show it in Preview.</>}</p>}
        {jobs.some((job) => job.kind === 'COVER' && !job.title.startsWith('Image update:')) && <p>Generated covers are saved in the image library. Choose a cover in the editor, then Save to update Preview.</p>}
        {jobs.some(job => job.title.startsWith('Image update:')) && <p>Completed image updates replace their original position in the editor automatically. Save to keep the change.</p>}
        <p className="font-medium">{onApply && allJobs.some(job => ['QUEUED', 'RUNNING'].includes(job.status) && job.title.startsWith('Image update:')) ? 'Please keep this page open while your image is generated.' : 'You can leave this page while requests run. Publishing is a separate step.'}</p>
      </div>
      <ul className="mt-4 max-h-64 space-y-3 overflow-auto">{jobs.map((job) => <li key={job.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-white p-4 shadow-sm"><span className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><span className="block break-words font-semibold text-neutral-950">{job.title}</span><span className={`mt-1 block text-xs font-medium ${job.status === 'READY' ? 'text-violet-700' : 'text-neutral-600'}`}>{job.status === 'READY' ? (job.title.startsWith('AI Assistant:') ? 'Assistant reply ready' : job.kind === 'WEBSITE' ? 'Website draft saved — ready in Preview' : job.kind === 'COVER' ? (job.title.startsWith('Image update:') ? 'Image update ready' : 'Cover ready in image library') : 'Ready — not yet added to Preview') : job.status === 'QUEUED' ? 'Queued' : job.status === 'RUNNING' ? 'Working in background' : 'Failed'}</span></span>{job.status === 'FAILED' && <ErrorNotice code="WT-CONTENT-001" message="Content generation failed. Please retry or send the error code to support." />}
        {job.status === 'READY' && (job.kind === 'WEBSITE' ? <>
          <a className={primaryAction} href={`/preview/${job.projectId}`} target="_blank" rel="noopener noreferrer">Preview website</a>
          {!onApply && <Link className={secondaryAction} href={`/projects/${job.projectId}/editor`} prefetch={false}>Edit website</Link>}
        </> : job.title.startsWith('AI Assistant:') && onApply ? <button disabled={!!busy} className={primaryAction} onClick={() => void act(job.id, async () => { const result = await readContentResult(job.id); window.dispatchEvent(new CustomEvent('awb-open-assistant', { detail: { pageId: result.pageId } })) })}>Open AI Assistant</button> : onApply && job.kind !== 'COVER' ? <button disabled={!!busy} className={primaryAction} onClick={() => void act(job.id, async () => setReview(await readContentResult(job.id)))}>Review</button> : <Link className={primaryAction} href={`/projects/${job.projectId}/editor`} target={projectId ? "_blank" : undefined} rel="noopener noreferrer">{job.title.startsWith("Image update:") ? "Open editor to apply image" : job.kind === "COVER" ? "Open editor to choose cover" : "Open editor to review"}</Link>)}
        {job.status === 'FAILED' && <button disabled={!!busy} className={primaryAction} onClick={() => void act(job.id, () => retryContentJob(job.id))}>Retry</button>}
        {['READY', 'FAILED'].includes(job.status) && <button disabled={!!busy} className={secondaryAction} onClick={() => void act(job.id, () => dismissContentJob(job.id))}>Dismiss</button>}
      </li>)}</ul>
      {review && <div className="my-2 rounded border bg-white p-3"><h3 className="font-semibold">Review generated content</h3><div className="my-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm">{copy(review.result)}</div><button className={primaryAction} onClick={() => { try { onApply?.(review); setReview(undefined); setHasError(false); setMessage('The content is in your editor draft. Save to show it in Preview.') } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : 'Could not add content') } }}>Add to editor draft</button><button className={`${secondaryAction} ml-3`} onClick={() => setReview(undefined)}>Close</button></div>}
    </details>
    {message && (hasError ? <ErrorNotice code="WT-CONTENT-001" message={message} /> : <p role="status" className="mt-2 text-xs">{message}</p>)}
  </div></>
}
