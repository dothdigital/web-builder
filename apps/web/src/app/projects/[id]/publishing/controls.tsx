'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addHostingDomain, choosePrimaryDomain, removePendingDomain, prepareHosting, checkHosting, publishHosting } from '@/app/actions/hosting'

export function PublishingControls({ projectId, configured, prepared, deploying, domains }: { projectId: string; configured: boolean; prepared: boolean; deploying: boolean; domains: Array<{ id: string; hostname: string; isPrimary: boolean; removable: boolean }> }) {
  const router = useRouter()
  const [hostname, setHostname] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true); setMessage('')
    try { const result = await action(); setMessage(result.message); router.refresh(); return result.ok }
    catch { setMessage('The request was interrupted. Check status before retrying publishing.'); return false }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!configured || busy || (!deploying && !domains.length)) return
    const timer = setInterval(() => { void checkHosting(projectId).then(() => router.refresh()).catch(() => {}) }, 30000)
    return () => clearInterval(timer)
  }, [configured, busy, deploying, domains.length, projectId, router])
  return <div className="grid gap-5 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap gap-2">
      {!prepared && <button disabled={busy || !configured} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => void run(() => prepareHosting(projectId))}>Prepare AWS hosting</button>}
      <button disabled={busy || !configured || deploying} className="rounded bg-sky-700 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => void run(() => publishHosting(projectId))}>{busy ? 'Working…' : 'Publish saved website'}</button>
      <button disabled={busy || !configured} className="rounded border px-4 py-2 text-sm disabled:opacity-40" onClick={() => void run(() => checkHosting(projectId))}>Check DNS & deployment</button>
    </div>
    <p className="text-xs text-neutral-500">Publish uses your latest saved draft. Save editor changes first. A release becomes live after AWS finishes deployment and refreshes its cache.</p>
    <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); if (await run(() => addHostingDomain(projectId, hostname))) setHostname('') }}>
      <label className="grid flex-1 gap-1 text-sm">Add your domain<input required maxLength={253} value={hostname} onChange={(event) => setHostname(event.target.value)} className="rounded border px-3 py-2" placeholder="www.yourbusiness.com" /></label>
      <button disabled={busy} className="self-end rounded border px-4 py-2 text-sm disabled:opacity-40">Add domain</button>
    </form>
    {domains.length > 0 && <label className="grid gap-1 text-sm">Primary address after next publish<select disabled={busy || deploying} className="rounded border p-2" value={domains.find((domain) => domain.isPrimary)?.id ?? ''} onChange={(event) => void run(() => choosePrimaryDomain(projectId, event.target.value || null))}><option value="">Use temporary CloudFront address</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.hostname}</option>)}</select><span className="text-xs text-neutral-500">Other connected domains will redirect to this address after publishing. Add both the root and www domains if you want both to work.</span></label>}
    {domains.some((domain) => domain.removable) && <details className="text-sm"><summary>Remove an unverified domain</summary>{domains.filter((domain) => domain.removable).map((domain) => <button key={domain.id} disabled={busy} onClick={() => void run(() => removePendingDomain(projectId, domain.id))} className="mt-2 block text-red-700 underline">Remove {domain.hostname}</button>)}</details>}
    {message && <p role="status" className="rounded bg-neutral-100 p-3 text-sm">{message}</p>}
  </div>
}
export function CopyDns({ value }: { value: string }) {
  const [message, setMessage] = useState('Copy')
  return <button type="button" className="ml-2 rounded border px-2 py-1 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(value); setMessage('Copied') } catch { setMessage('Select and copy the value') } }}>{message}</button>
}
