'use client'
import { ErrorNotice } from '@/components/error-notice'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { connectAnalytics, disconnectAnalytics, saveTrackingHost } from '@/app/actions/analytics'

export function AnalyticsConnection({ projectId, propertyId }: { projectId: string; propertyId?: string | null }) {
  const router = useRouter()
  const [property, setProperty] = useState(propertyId ?? '')
  const [credentials, setCredentials] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  return <details open={!propertyId} className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">{propertyId ? `Google Analytics connected · Property ${propertyId}` : 'Connect Google Analytics'}</summary>
    <div className="mt-4 grid max-w-xl gap-3 text-sm">
      <p>Enable the Google Analytics Data API, create a service account, and grant its email Viewer access to your GA4 property. <a className="text-sky-700 underline" href="https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart" target="_blank" rel="noreferrer">Google setup guide</a></p>
      <label className="grid gap-1">GA4 property ID<input className="rounded border p-2" inputMode="numeric" placeholder="123456789 (not the G- measurement ID)" value={property} onChange={(event) => setProperty(event.target.value.trim())} /></label>
      <label className="grid gap-1">Service-account JSON file<input type="file" accept=".json,application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 30000) { setHasError(true); setMessage('Choose a service-account JSON file smaller than 30 KB.'); return } try { setCredentials(await file.text()); setHasError(false); setMessage('Credentials selected. Connect to verify access.'); event.target.value = '' } catch { setHasError(true); setMessage('Could not read the credentials file. Please select it again.') } }} /></label>
      <p className="text-xs text-neutral-500">Credentials are encrypted on the server and never included in website exports. Your site’s G- measurement ID is configured separately under Editor → Integrations.</p>
      <div className="flex gap-2"><button type="button" disabled={busy || !credentials || !/^\d+$/.test(property)} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40" onClick={async () => { setHasError(false); setBusy(true); setMessage(''); try { await connectAnalytics(projectId, property, credentials); setCredentials(''); setMessage('Connected successfully.'); router.refresh() } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : 'Could not connect.') } finally { setBusy(false) } }}>{busy ? 'Checking…' : 'Connect Google Analytics'}</button>
      {propertyId && <button type="button" disabled={busy} className="rounded border px-4 py-2" onClick={async () => { setHasError(false); setBusy(true); try { await disconnectAnalytics(projectId); setCredentials(''); setMessage('Disconnected. Website tracking is unchanged.'); router.refresh() } catch { setHasError(true); setMessage('Could not disconnect. Please retry.') } finally { setBusy(false) } }}>Disconnect</button>}</div>
      {message && (hasError ? <ErrorNotice code="WT-ANALYTICS-001" message={message} /> : <p role="status">{message}</p>)}
    </div>
  </details>
}

export function TrackingHost({ projectId, hostname }: { projectId: string; hostname?: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(hostname ?? '')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [busy, setBusy] = useState(false)
  return <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5" onSubmit={async (event) => { event.preventDefault(); setHasError(false); setBusy(true); try { await saveTrackingHost(projectId, value); setMessage('Tracking domain saved. Deploy the latest export to start recording visits.'); router.refresh() } catch (error) { setHasError(true); setMessage(error instanceof Error ? error.message : 'Could not save domain.') } finally { setBusy(false) } }}><label className="grid gap-1 text-sm">Website tracking domain<input required className="rounded border p-2" placeholder="www.example.com" value={value} onChange={(event) => setValue(event.target.value)} /></label><button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save domain'}</button>{message && (hasError ? <ErrorNotice code="WT-ANALYTICS-001" message={message} /> : <p role="status" className="w-full text-sm">{message}</p>)}</form>
}

export function RefreshReport() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={() => startTransition(() => router.refresh())}>{pending ? 'Refreshing…' : 'Refresh data'}</button>
}
