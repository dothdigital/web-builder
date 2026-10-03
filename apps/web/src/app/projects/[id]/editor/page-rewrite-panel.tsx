'use client'
import { useState } from 'react'
import type { WebsiteModel, WebsitePage } from '@awb/website-model'
import { rewritePageWithAi } from '@/app/actions/editor'
export function PageRewritePanel({ projectId, model, page }: { projectId: string; model: WebsiteModel; page: WebsitePage; onApply?: (page: WebsitePage) => void }) {
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <fieldset className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3"><legend className="px-1 text-sm font-semibold">Rewrite page with AI</legend><label className="grid gap-1 text-xs">What would you like to change?<textarea className="rounded border p-2" rows={4} maxLength={4000} value={instruction} disabled={busy} onChange={(event) => setInstruction(event.target.value)} /></label><p className="text-xs">Runs in the background. Review the result using the notification at the top. Layout and images stay in place.</p><button disabled={busy || !instruction.trim()} className="rounded bg-sky-700 p-2 text-white disabled:opacity-50" onClick={async () => { setBusy(true); try { await rewritePageWithAi(projectId, { model, pageId: page.id, instruction }); setMessage('Queued. You can keep working; we will notify you when ready.'); window.dispatchEvent(new Event('awb-content-queued')) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not queue request') } finally { setBusy(false) } }}>{busy ? 'Queuing…' : 'Rewrite in background'}</button>{message && <p role="status" className="text-xs">{message}</p>}</fieldset>
}
