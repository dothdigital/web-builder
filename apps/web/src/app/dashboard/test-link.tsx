'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkTestUrl, createTestUrl } from '@/app/actions/hosting'

export function TestLink({ projectId, name, initialUrl, pending }: { projectId: string; name: string; initialUrl: string | null; pending: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [deploying, setDeploying] = useState(pending)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  async function prepare(check = false) {
    setBusy(true); setError(false); setCopied(false); setMessage('Preparing your test link…')
    try {
      const result = await (check ? checkTestUrl(projectId) : createTestUrl(projectId))
      if (result.url) setUrl(result.url)
      setDeploying(result.deploying); setError(!result.ok); setMessage(result.message)
      router.refresh()
    } catch { setError(true); setMessage('Could not prepare the test link. Please try again.'); setDeploying(false) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!open || !deploying || busy) return
    const timer = setTimeout(() => { void prepare(true) }, 5000)
    return () => clearTimeout(timer)
  }, [open, deploying, busy, projectId])

  function show() {
    setCopied(false); setOpen(true); dialog.current?.showModal()
    if (!url && !busy) void prepare(deploying)
  }
  async function copy() {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true) }
    catch { setMessage('Select the link below and copy it.'); setCopied(false) }
  }
  return <>
    <button type="button" onClick={show} className="cursor-pointer text-violet-700">Test link</button>
    <dialog ref={dialog} aria-labelledby={heading} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current?.close() }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/50">
      <div className="p-6" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4"><h2 id={heading} className="text-xl font-semibold">Test link</h2><button type="button" aria-label="Close test link" className="cursor-pointer rounded px-2 py-1 text-xl" onClick={() => dialog.current?.close()}>×</button></div>
        <p className="mt-2 text-sm font-medium">{name}</p>
        <p className="mt-2 text-sm text-neutral-600">Share this link with clients. They can view your saved website without signing in or connecting a domain.</p>
        {url && <><label htmlFor={`${heading}-url`} className="mt-5 block text-sm font-medium">Shareable link</label><input id={`${heading}-url`} value={url} readOnly onFocus={event => event.currentTarget.select()} className="mt-2 block w-full min-w-0 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm" /><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="wt-button" onClick={() => { void copy() }}>{copied ? 'Copied!' : 'Copy link'}</button><a href={url} target="_blank" rel="noreferrer" className="wt-button secondary">Open test website ↗</a></div><p className="mt-4 text-xs text-neutral-500">Save editor changes, then update this link to share the latest version.</p></>}
        {message && <p role={error ? 'alert' : 'status'} className={`mt-4 text-sm ${error ? 'text-red-700' : 'text-neutral-600'}`}>{message}</p>}
        {!deploying && <button type="button" disabled={busy} className="mt-4 cursor-pointer text-sm font-medium text-violet-700 disabled:opacity-50" onClick={() => { void prepare() }}>{busy ? 'Preparing…' : url ? 'Update test link' : 'Retry'}</button>}
      </div>
    </dialog>
  </>
}
