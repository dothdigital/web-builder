'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { loadBillingManagement, startPaymentUpdate, finishPaymentUpdate, cancelSubscription } from '@/app/actions/billing-management'
import styles from './billing-management.module.css'

type Summary = Extract<Awaited<ReturnType<typeof loadBillingManagement>>, { ok: true }>['summary']
type Setup = Extract<Awaited<ReturnType<typeof startPaymentUpdate>>, { ok: true }>

function PaymentUpdateForm({ returnUrl, onSaved, onBusy }: { returnUrl: string; onSaved: (message: string) => void; onBusy: (busy: boolean) => void }) {
  const stripe = useStripe(), elements = useElements()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ready, setReady] = useState(false), [consent, setConsent] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || busy || !consent) return
    setBusy(true); onBusy(true); setError('')
    try {
      const result = await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' })
      if (result.error) { setError(result.error.message || 'Please check your card details.'); return }
      if (!result.setupIntent || result.setupIntent.status !== 'succeeded') { setError('Your card has not been confirmed yet. Please try again.'); return }
      const saved = await finishPaymentUpdate(result.setupIntent.id)
      if (saved.ok) onSaved(saved.message)
      else setError(saved.message)
    } catch { setError('Payment details could not be saved. Please try again.') }
    finally { setBusy(false); onBusy(false) }
  }
  return <form onSubmit={save} className={styles.paymentForm}>
    <h3>Update payment details</h3>
    <PaymentElement onReady={() => setReady(true)} onLoadError={() => setError('The secure card form could not load. Please try again.')} />
    <label className={styles.confirm}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required />Save this card for my subscription payments, including monthly renewals.</label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="submit" className="wt-button" disabled={!stripe || !elements || !ready || !consent || busy}>{busy ? 'Saving…' : 'Save payment details'}</button>
  </form>
}

function PaymentEditor({ setup, onSaved, onBusy }: { setup: Setup; onSaved: (message: string) => void; onBusy: (busy: boolean) => void }) {
  const [stripe] = useState(() => loadStripe(setup.publishableKey))
  return <Elements stripe={stripe} options={{ clientSecret: setup.clientSecret }}><PaymentUpdateForm returnUrl={setup.returnUrl} onSaved={onSaved} onBusy={onBusy} /></Elements>
}

export function BillingManagement({ initialSetupId }: { initialSetupId?: string }) {
  const router = useRouter(), dialog = useRef<HTMLDialogElement>(null), returnedSetup = useRef(false)
  const [summary, setSummary] = useState<Summary | null>(null), [setup, setSetup] = useState<Setup | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false), [confirmed, setConfirmed] = useState(false)
  async function refreshSummary() {
    const result = await loadBillingManagement()
    if (result.ok) setSummary(result.summary)
    else setError(result.message)
  }
  async function open() {
    setError(''); setNotice(''); setSetup(null); setConfirming(false); setConfirmed(false)
    dialog.current?.showModal(); setBusy(true)
    try { await refreshSummary() } catch { setError('Billing details could not load. Please try again.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!initialSetupId || returnedSetup.current) return
    returnedSetup.current = true
    dialog.current?.showModal(); setBusy(true)
    // Remove Stripe's returned client secret from the browser URL.
    window.history.replaceState(null, '', '/billing')
    void (async () => {
      try {
        const result = await finishPaymentUpdate(initialSetupId)
        if (result.ok) { setNotice(result.message); router.replace('/billing') }
        else setError(result.message)
        await refreshSummary()
      } catch { setError('Payment details could not be saved. Please try again.') }
      finally { setBusy(false) }
    })()
  }, [initialSetupId, router])
  async function startUpdate() {
    setBusy(true); setError(''); setNotice(''); setConfirming(false)
    try { const result = await startPaymentUpdate(); if (result.ok) setSetup(result); else setError(result.message) }
    catch { setError('Payment updates could not start. Please try again.') }
    finally { setBusy(false) }
  }
  async function cancel() {
    if (!confirmed || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await cancelSubscription(confirmed)
      if (result.ok) { setNotice(result.message); setConfirming(false); setConfirmed(false); await refreshSummary(); router.refresh() }
      else setError(result.message)
    } catch { setError('Cancellation could not complete. Please refresh billing and try again.') }
    finally { setBusy(false) }
  }
  const ended = summary && ['canceled', 'incomplete_expired'].includes(summary.status)
  const date = summary?.periodEnd ? new Date(summary.periodEnd).toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' }) : null
  return <>
    <button className="wt-button" type="button" onClick={() => void open()}>Manage payment, invoices & cancellation</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="billing-dialog-title" onCancel={event => { if (busy) event.preventDefault() }}>
      <header className={styles.header}><h2 id="billing-dialog-title">Manage billing</h2><button type="button" className="wt-button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Close</button></header>
      <div className={styles.body}>
        {busy && !summary && <p role="status">Loading billing details…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.success}>{notice}</p>}
        {summary && <>
          <section><h3>Payment details</h3>{summary.card ? <p>{summary.card.brand.toUpperCase()} ending in {summary.card.last4} · expires {summary.card.month}/{summary.card.year}</p> : <p>No default card is saved.</p>}
            <button type="button" className="wt-button secondary" disabled={busy || !!ended} onClick={() => void startUpdate()}>Update payment details</button>
          </section>
          {setup && <PaymentEditor setup={setup} onBusy={setBusy} onSaved={message => { setSetup(null); setNotice(message); void refreshSummary(); router.refresh() }} />}
          <section><h3>Invoices</h3><p>View payment history and download invoices on this page.</p><button type="button" className="wt-button secondary" disabled={busy} onClick={() => { dialog.current?.close(); document.getElementById('billing-payment-history')?.scrollIntoView({ behavior: 'smooth' }) }}>View invoices</button></section>
          <section><h3>Subscription</h3>
            <p>{ended ? 'Your subscription has ended.' : summary.cancellationScheduled ? `Renewal is cancelled.${date ? ` Access continues through ${date}.` : ''}` : `Your subscription renews automatically.${date ? ` Current period ends ${date}.` : ''}`}</p>
            {!ended && !summary.cancellationScheduled && !confirming && <button type="button" className={styles.danger} disabled={busy} onClick={() => { setSetup(null); setError(''); setNotice(''); setConfirmed(false); setConfirming(true) }}>Cancel subscription</button>}
            {confirming && <div className={styles.cancellation}>
              <h3>Confirm cancellation</h3><p>Cancel renewal? You will keep access{date ? ` through ${date}` : ' through your paid period'}. Your subscription will end after that period.</p>
              <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I understand that my subscription will not renew.</label>
              <div className={styles.actions}><button type="button" className="wt-button secondary" disabled={busy} onClick={() => { setConfirming(false); setConfirmed(false) }}>Keep subscription</button><button type="button" className={styles.danger} disabled={busy || !confirmed} onClick={() => void cancel()}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
            </div>}
          </section>
        </>}
      </div>
    </dialog>
  </>
}
