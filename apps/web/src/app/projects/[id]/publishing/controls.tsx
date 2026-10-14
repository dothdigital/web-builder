'use client'
import { ErrorNotice } from '@/components/error-notice'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { addHostingDomain, choosePrimaryDomain, removePendingDomain, prepareHosting, checkHosting, publishHosting } from '@/app/actions/hosting'

export function PublishingControls({ projectId, canEdit, configured, prepared, deploying, previewDeploying, domains, children }: { projectId: string; canEdit: boolean; configured: boolean; prepared: boolean; deploying: boolean; previewDeploying: boolean; domains: Array<{ id: string; hostname: string; isPrimary: boolean; removable: boolean; ready: boolean }>; children: ReactNode }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [adding, setAdding] = useState(false)
  const [temporary, setTemporary] = useState(false)
  const [hostname, setHostname] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [dnsFeedback, setDnsFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [readinessFeedback, setReadinessFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const primary = domains.find(domain => domain.isPrimary)
  const dnsVerified = domains.length > 0 && domains.every(domain => domain.ready)
  const ready = prepared && !deploying && (temporary ? !primary : !!primary?.ready)
  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setHasError(false); setBusy(true); setMessage('')
    try { const result = await action(); setHasError(!result.ok); setMessage(result.message); router.refresh(); return result.ok }
    catch { setHasError(true); setMessage('The request was interrupted. Check status before retrying publishing.'); return false }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!canEdit || !configured || busy || !(deploying || previewDeploying || step === 1 || step === 2)) return
    const timer = setInterval(() => { void checkHosting(projectId).then(() => router.refresh()).catch(() => {}) }, 30000)
    return () => clearInterval(timer)
  }, [canEdit, configured, busy, deploying, previewDeploying, step, projectId, router])
  const button = 'wt-button whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600'
  const next = async () => {
    if (!primary && domains.length && canEdit && !temporary) {
      if (!await run(() => choosePrimaryDomain(projectId, domains[0].id))) return
    }
    setAdding(false); setStep(1); setMessage('')
  }
  return <div className="grid gap-5 rounded-xl border bg-white p-5">
    <h2 className="font-semibold">Publish your website</h2>
    <ol aria-label="Publishing steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{['Domain', 'DNS setup', 'Deployment', 'Publish'].map((label, index) => <li key={label}><button type="button" aria-current={step === index ? 'step' : undefined} disabled={busy || index > step} onClick={() => { setStep(index); setMessage('') }} className={`${button} w-full ${step === index ? '' : 'secondary'}`}>{index + 1}. {label}</button></li>)}</ol>
    {step === 0 && <section className="grid gap-4">
      <h3 className="font-semibold">Choose your domain</h3>
      {domains.length > 0 && <><p>Primary domain: <strong>{primary?.hostname ?? domains[0].hostname}</strong></p><p className="text-sm">Do you want to add another domain? Additional connected domains will redirect to your primary domain after publishing.</p><div className="flex gap-2"><button disabled={busy || !canEdit} className={button} onClick={() => { setTemporary(false); setAdding(true) }}>Yes, add another domain</button><button disabled={busy || deploying} className={button} onClick={() => { setTemporary(false); void next() }}>No, continue to DNS</button></div></>}
      {(!domains.length || adding) && canEdit && <form className="flex flex-wrap gap-2" onSubmit={async event => { event.preventDefault(); if (await run(() => addHostingDomain(projectId, hostname))) { setHostname(''); setAdding(false); setTemporary(false) } }}><label className="grid flex-1 gap-1 text-sm">{domains.length ? 'Additional domain' : 'Add your domain'}<input required maxLength={253} value={hostname} onChange={event => setHostname(event.target.value)} className="rounded border px-3 py-2" placeholder="www.yourbusiness.com" /></label><button disabled={busy || deploying} className={`${button} self-end`}>Add domain</button></form>}
      {adding && <button className={button} onClick={() => setAdding(false)}>Cancel adding another domain</button>}
      {!domains.length && <button disabled={busy || deploying || !canEdit} className={button} onClick={async () => { if (await run(() => choosePrimaryDomain(projectId, null))) { setTemporary(true); setStep(1) } }}>Use Webtummy address for now</button>}
      {domains.some(domain => domain.removable) && canEdit && <details className="text-sm"><summary>Remove an unverified domain</summary>{domains.filter(domain => domain.removable).map(domain => <button key={domain.id} disabled={busy || deploying} onClick={() => void run(() => removePendingDomain(projectId, domain.id))} className="mt-2 block text-red-700 underline">Remove {domain.hostname}</button>)}</details>}
    </section>}
    {step === 1 && <section className="grid gap-4">
      <h3 className="font-semibold">{dnsVerified && !temporary ? 'DNS setup complete' : 'Set up your DNS records'}</h3>
      {temporary ? <p>Your Webtummy address does not require DNS changes.</p> : dnsVerified ? <>
        <div role="status" className="flex items-start gap-4 rounded-xl border-2 border-green-600 bg-green-50 p-5 text-green-950">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-700 text-2xl text-white">✓</span>
          <div><h4 className="text-xl font-bold">Domain verified and ready to publish</h4><p className="mt-1 break-all font-semibold">{domains.map(domain => domain.hostname).join(', ')}</p><p className="mt-2 text-sm">Ownership verified · DNS routing verified · Cloudflare HTTPS active.</p><p className="mt-2 text-sm">DNS setup is complete. Continue to deployment to publish your website.</p></div>
        </div>
        <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">View DNS records</summary><div className="mt-4">{children}</div></details>
      </> : <>
        <ol className="list-decimal space-y-2 pl-5 text-sm"><li>Sign in where your domain’s DNS is managed and open DNS settings.</li><li>Add the TXT ownership record and the routing record shown below: ALIAS / ANAME for a root domain, or CNAME for a subdomain. Copy the short Host for providers that append your domain automatically.</li><li>Save the records, then check DNS. If additional HTTPS TXT records appear, add those too and check again.</li></ol>
        {children}
        <button disabled={busy || !configured || !canEdit} className={button} onClick={() => { setDnsFeedback(null); void run(async () => { try { const result = await checkHosting(projectId); setDnsFeedback(result); return result } catch { const result = { ok: false, message: 'The DNS check was interrupted. Please try checking again.' }; setDnsFeedback(result); return result } }) }}>{busy ? 'Checking DNS…' : 'Check DNS records'}</button>
        <div aria-live="polite" aria-atomic="true">{busy ? <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">Checking domain ownership, DNS routing and Cloudflare HTTPS…</p> : dnsFeedback ? dnsFeedback.ok ? <p role="status" className="whitespace-pre-line rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{dnsFeedback.message}</p> : <ErrorNotice code="WT-PUBLISH-001" message={dnsFeedback.message} /> : <p role="status" className="text-sm text-neutral-600">Verification is pending. Add the records above, then check DNS to see the latest result.</p>}</div>
        <p className="text-sm text-neutral-500">DNS changes may take several minutes or longer to appear. You can return here to check again.</p>
      </>}
      <button disabled={busy} className={button} onClick={() => { setStep(2); setMessage('') }}>Continue to deployment</button>
    </section>}
    {step === 2 && <section className="grid gap-4">
      <h3 className="font-semibold">{ready ? 'Ready to publish' : 'Check deployment readiness'}</h3>
      {ready ? <>
        <div role="status" className="flex items-start gap-4 rounded-xl border-2 border-green-600 bg-green-50 p-5 text-green-950">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-700 text-2xl text-white">✓</span>
          <div><h4 className="text-xl font-bold">Everything is ready</h4><p className="mt-1 break-all font-semibold">{temporary ? 'Your Webtummy address' : primary?.hostname}</p><p className="mt-2 text-sm">Hosting is prepared. {temporary ? 'No custom DNS is required.' : 'Domain ownership, DNS routing and Cloudflare HTTPS are verified.'}</p><p className="mt-2 text-sm">Continue to review and publish your saved website.</p></div>
        </div>
        <button disabled={busy} className={button} onClick={() => { setStep(3); setMessage('') }}>Continue to publish</button>
      </> : <>
        <p className="text-sm">Complete the pending items below before publishing.</p>
        <ul className="space-y-2 text-sm"><li>Hosting: {prepared ? 'Prepared' : 'Needs preparation'}</li><li>Domain: {temporary ? 'Using Webtummy address' : primary?.hostname ?? 'Return to Domain to select your primary domain'}</li><li>DNS &amp; HTTPS: {temporary ? 'No custom DNS required' : primary?.ready ? 'Verified and ready' : 'Waiting for verification — check DNS setup'}</li><li>Deployment: {deploying ? 'In progress' : 'No deployment in progress'}</li></ul>
        <button disabled={busy || !configured || !canEdit} className={button} onClick={() => { setReadinessFeedback(null); void run(async () => { try { if (!prepared) { const preparedResult = await prepareHosting(projectId); if (!preparedResult.ok) { setReadinessFeedback(preparedResult); return preparedResult } } const result = await checkHosting(projectId); setReadinessFeedback(result); return result } catch { const result = { ok: false, message: 'The readiness check was interrupted. Please try again.' }; setReadinessFeedback(result); return result } }) }}>{busy ? 'Checking readiness…' : !prepared ? 'Prepare hosting' : deploying ? 'Check deployment status' : 'Check readiness'}</button>
        <div aria-live="polite" aria-atomic="true">{busy ? <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">Checking hosting, domain verification and deployment status…</p> : readinessFeedback ? readinessFeedback.ok ? <p role="status" className="whitespace-pre-line rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{readinessFeedback.message}</p> : <ErrorNotice code="WT-PUBLISH-001" message={readinessFeedback.message} /> : <p role="status" className="text-sm">If DNS or HTTPS verification is pending, return to DNS setup and add any required records.</p>}</div>
      </>}
    </section>}
    {step === 3 && <section className="grid gap-4">
      <h3 className="font-semibold">{deploying ? 'Publishing your website' : 'Publish your saved website'}</h3>
      <p className="text-sm">Address: <strong>{temporary ? 'Your Webtummy address' : primary?.hostname}</strong></p>
      {deploying ? <>
        <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-5 font-medium text-sky-900">Your website is deploying. This page checks progress automatically.</p>
        <button disabled={busy || !canEdit || !configured} className={button} onClick={() => void run(() => checkHosting(projectId, true))}>{busy ? 'Checking deployment…' : 'Check deployment status'}</button>
      </> : <>
        <p className="text-sm">Save your editor changes, then publish your latest saved draft to this address.</p>
        <button disabled={busy || !configured || !ready || !canEdit} className={button} onClick={() => void run(() => publishHosting(projectId))}>{busy ? 'Publishing…' : 'Publish saved website'}</button>
      </>}
    </section>}
    {step > 0 && <button disabled={busy} className={`${button} secondary justify-self-start`} onClick={() => { setStep(step - 1); setMessage('') }}>Back</button>}
    {message && (hasError ? <ErrorNotice code="WT-PUBLISH-001" message={message} /> : <p role="status" className={`rounded-lg p-4 text-sm ${step === 3 ? 'border border-green-200 bg-green-50 text-green-950' : 'bg-neutral-100'}`}>{message}</p>)}
  </div>
}
export function CopyDns({ value, label = 'Copy DNS value' }: { value: string; label?: string }) {
  const [message, setMessage] = useState('Copy')
  return <button type="button" aria-label={label} title={label} className="ml-2 rounded border px-2 py-1 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(value); setMessage('Copied') } catch { setMessage('Select and copy the value') } }}>{message}</button>
}
