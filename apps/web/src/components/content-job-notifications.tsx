'use client'
import { useCallback, useEffect, useState } from 'react'
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
  const [jobs, setJobs] = useState<Job[]>([])
  const [review, setReview] = useState<ContentResult>()
  const [message, setMessage] = useState('')
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
  const act = async (id: string, action: () => Promise<unknown>) => { setBusy(id); setMessage(''); try { await action(); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update request') } finally { setBusy(undefined) } }
  if (!jobs.length && !message) return null
  const ready = jobs.filter((job) => job.status === 'READY').length
  return <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm">
    <details open={!!review || ready > 0}><summary className="cursor-pointer font-medium">{ready ? `Content ready — ${ready} request${ready > 1 ? 's' : ''} to review` : `AI background requests (${jobs.length})`}</summary>
      <p className="my-2 text-xs text-neutral-600">You can leave this page. Generated pages wait here for review. Click Review, add to the editor draft, then Save to show them in Preview. Publishing is a separate step.</p>
      <ul className="max-h-48 overflow-auto">{jobs.map((job) => <li key={job.id} className="flex flex-wrap items-center gap-2 border-t py-2"><span className="flex-1">{job.title} · {job.status === 'READY' ? (job.title.startsWith('AI Assistant:') ? 'Assistant reply ready' : job.kind === 'COVER' ? 'Cover ready in image library' : 'Ready — not yet added to Preview') : job.status === 'QUEUED' ? 'Queued' : job.status === 'RUNNING' ? 'Working in background' : 'Failed'}</span>
        {job.status === 'READY' && (job.title.startsWith('AI Assistant:') && onApply ? <button disabled={!!busy} className="text-violet-800 underline" onClick={() => void act(job.id, async () => { const result = await readContentResult(job.id); window.dispatchEvent(new CustomEvent('awb-open-assistant', { detail: { pageId: result.pageId } })) })}>Open AI Assistant</button> : onApply && !['WEBSITE', 'COVER'].includes(job.kind) ? <button disabled={!!busy} className="text-violet-800 underline" onClick={() => void act(job.id, async () => setReview(await readContentResult(job.id)))}>Review</button> : <Link className="text-violet-800 underline" href={`/projects/${job.projectId}/editor`} target={projectId ? "_blank" : undefined} rel="noopener noreferrer">{job.kind === "COVER" ? "Open editor to choose cover" : projectId ? "Open generated draft in new tab" : "Open editor"}</Link>)}
        {job.status === 'FAILED' && <button disabled={!!busy} className="underline" onClick={() => void act(job.id, () => retryContentJob(job.id))}>Retry</button>}
        {['READY', 'FAILED'].includes(job.status) && <button disabled={!!busy} className="text-neutral-600 underline" onClick={() => void act(job.id, () => dismissContentJob(job.id))}>Dismiss</button>}
      </li>)}</ul>
      {review && <div className="my-2 rounded border bg-white p-3"><h3 className="font-semibold">Review generated content</h3><div className="my-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm">{copy(review.result)}</div><button className="rounded bg-violet-700 px-3 py-2 text-white" onClick={() => { try { onApply?.(review); setReview(undefined); setMessage('The content is in your editor draft. Save to show it in Preview.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add content') } }}>Add to editor draft</button><button className="ml-3 underline" onClick={() => setReview(undefined)}>Close</button></div>}
    </details>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </div>
}
