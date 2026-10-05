'use client'
import { ErrorNotice } from '@/components/error-notice'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBlogCover, readContentResult } from '@/app/actions/content-jobs'
import { LibraryThumbnail } from './inspector'

export function AiBlogCover({ projectId, topic, keyword, details, onUse }: {
  projectId: string; topic: string; keyword: string; details: string
  onUse: (url: string, alt: string) => void
}) {
  const router = useRouter()
  const [direction, setDirection] = useState('')
  const [jobId, setJobId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ url: string; alt: string }>()
  const [error, setError] = useState('')
  const [used, setUsed] = useState(false)
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    let polling = false
    const controller = new AbortController()
    const poll = async () => {
      if (polling || document.hidden) return
      polling = true
      try {
        const response = await fetch(`/api/content-jobs?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal })
        if (!response.ok) return
        const payload = await response.json() as { jobs: Array<{ id: string; status: string }> }
        const job = payload.jobs.find((entry) => entry.id === jobId)
        if (job?.status === 'READY') {
          const completed = await readContentResult(jobId)
          if (cancelled) return
          const image = completed.result as { url: string; alt: string }
          setResult(image); setJobId(undefined); router.refresh()
        } else if (job?.status === 'FAILED' && !cancelled) {
          setError('Image generation failed. Try again or choose an image from your library.'); setJobId(undefined)
        }
      } catch { /* Retry temporary connection errors on the next poll. */ }
      finally { polling = false }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 15000)
    return () => { cancelled = true; controller.abort(); clearInterval(timer) }
  }, [jobId, projectId, router])
  return <div className="grid gap-2 rounded border border-violet-200 bg-white p-3">
    <label className="grid gap-1">AI image description (optional)<textarea rows={2} maxLength={1000} value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="For example: a conceptual illustration of a family protecting their future, in blue and gold" className="rounded border p-2" /></label>
    <p>Uses your blog topic, keyword and brief. Generated images are saved in your project library.</p>
    <button type="button" disabled={busy || !!jobId || topic.trim().length < 3} className="rounded bg-violet-700 p-2 text-white disabled:opacity-50" onClick={async () => {
      setBusy(true); setError(''); setUsed(false)
      try {
        const job = await createBlogCover(projectId, { topic, keyword, details, direction, requestId: crypto.randomUUID() })
        setJobId(job.jobId); setResult(undefined); window.dispatchEvent(new Event('awb-content-queued'))
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not queue image generation.') }
      finally { setBusy(false) }
    }}>{busy ? 'Queuing…' : jobId ? 'Generating in background…' : result ? 'Generate another cover with AI' : 'Generate cover with AI'}</button>
    {topic.trim().length < 3 && <p>Enter a blog topic above to generate its cover.</p>}
    {jobId && <p role="status">You can keep working. If you close this form, choose the completed cover from your image library when the notification says it is ready.</p>}
    {result && <><LibraryThumbnail src={`/api/projects/${projectId}/editor-image?thumbnail=1&url=${encodeURIComponent(result.url)}`} name={result.alt} /><button type="button" className="rounded border border-violet-400 p-2 text-violet-900" onClick={() => { onUse(result.url, result.alt); setUsed(true) }}>Use this cover</button></>}
    {used && <p role="status">Cover selected for this blog.</p>}
    {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-red-700" />}
  </div>
}
