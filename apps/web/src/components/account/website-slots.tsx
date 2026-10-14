'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewWebsitePurchase, confirmWebsitePurchase, refreshWebsitePurchase, cancelWebsitePurchase } from '@/app/actions/website-slots'
import styles from './billing-management.module.css'

type Purchase = Extract<Awaited<ReturnType<typeof reviewWebsitePurchase>>, { ok: true }>['purchase']
const money = (amount: number, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)

export function WebsiteSlots({ quantity, used, owner, available, trialing }: { quantity: number; used: number; owner: boolean; available: boolean; trialing: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), router = useRouter()
  const [purchase, setPurchase] = useState<Purchase | null>(null), [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function review() {
    if (busy) return
    setBusy(true); setError(''); setNotice(''); setConfirmed(false); setPurchase(null); dialog.current?.showModal()
    try { const result = await reviewWebsitePurchase(); if (result.ok) setPurchase(result.purchase); else setError(result.message) }
    catch { setError('The price could not load. Please try again.') }
    finally { setBusy(false) }
  }
  async function buy() {
    if (busy || !confirmed || purchase?.status !== 'quote') return
    setBusy(true); setError('')
    try {
      const result = await confirmWebsitePurchase(purchase.token, confirmed)
      if (!result.ok) { setError(result.message); return }
      if (result.purchase.status === 'pending') setPurchase(result.purchase)
      else { setPurchase(null); setNotice('Payment confirmed. Opening your new website form…'); dialog.current?.close(); window.location.assign('/onboarding') }
    } catch { setError('We could not confirm payment. Refresh the status before trying again.') }
    finally { setBusy(false) }
  }
  async function refresh() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await refreshWebsitePurchase()
      if (!result.ok) { setError(result.message); return }
      router.refresh()
      if (purchase && result.paid && result.quantity >= purchase.quantity + (purchase.status === 'pending' ? 1 : 0)) {
        setPurchase(null); setNotice('Payment confirmed. Opening your new website form…'); dialog.current?.close(); window.location.assign('/onboarding')
      } else { setPurchase(null); setConfirmed(false); setNotice('Status refreshed. Review the purchase to check any remaining payment steps.') }
    } catch { setError('The payment status could not refresh. Please try again.') }
    finally { setBusy(false) }
  }
  async function cancelPending() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await cancelWebsitePurchase()
      if (!result.ok) { setError(result.message); return }
      setPurchase(null); setNotice('Any unpaid website purchase was cancelled. Payments already completed keep their website slot.'); router.refresh()
    } catch { setError('Cancellation could not be confirmed. Refresh the status.') }
    finally { setBusy(false) }
  }
  return <section id="website-slots" className="wt-card mt-6">
    <h2>Your website slots</h2>
    <p className="mt-3">{used} of {quantity} website slots in use. Monthly price: {money(quantity * 2900)} before discounts and tax.</p>
    <p className="wt-muted mt-3">Each website is US$29/month. {trialing ? 'Adding another website ends your free trial and starts paid monthly billing for both websites immediately.' : 'The first charge for an additional website covers the rest of your current billing period.'} All websites renew together. Deleting a website frees its slot for reuse and does not reduce your subscription.</p>
    <div className={`${styles.actions} mt-6`}>
      {used < quantity && <a href="/onboarding" className="wt-button">Create a website</a>}
      {owner && <button type="button" className="wt-button" disabled={busy || !available} onClick={() => void review()}>{trialing ? 'Upgrade / add new website' : 'Add website · $29/month'}</button>}
      {owner && <button type="button" className="wt-button secondary" disabled={busy} onClick={() => void refresh()}>Refresh payment status</button>}
    </div>
    {!owner && <p className="wt-muted mt-3">Only a workspace owner can purchase additional website slots.</p>}
    {owner && !available && <p className="wt-muted mt-3">Resume renewal or resolve your subscription payment before purchasing another website.</p>}
    {notice && <p role="status" className={`${styles.success} mt-3`}>{notice} <a href="/onboarding">Create a website →</a></p>}
    {error && <p role="alert" className={`${styles.error} mt-3`}>{error}</p>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="website-purchase-title" onCancel={event => { if (busy) event.preventDefault() }}>
      <header className={styles.header}><h2 id="website-purchase-title">Add another website</h2><button className="wt-button secondary" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Close</button></header>
      <div className={styles.body}>
        {busy && !purchase && <p role="status">Checking your subscription and price…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.success}>{notice}</p>}
        {purchase?.status === 'quote' && <section>
          {purchase.endsTrial && <div className="wt-notice" role="note"><h3>Your free trial will end</h3><p>Proceeding with this upgrade will end your free trial and charge your saved payment method immediately for {purchase.quantity} websites. Paid monthly billing starts today. No new 7-day trial will be added.</p></div>}
          <p><strong>Due today: {money(purchase.amountDue, purchase.currency)}</strong></p>
          <p>New monthly price: {money(purchase.monthlyAmount, purchase.currency)} for {purchase.quantity} websites, before discounts and tax. {purchase.renewalDate ? `Your next renewal is ${new Date(purchase.renewalDate).toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' })}.` : 'Your subscription will renew monthly from today.'}</p>
          <p>Today’s amount includes applicable discounts, credits and tax calculated by Stripe. We will charge your saved payment method. The new slot opens after payment confirmation.</p>
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{purchase.endsTrial ? `I agree to end my free trial, pay today’s amount immediately, and start a ${money(purchase.monthlyAmount, purchase.currency)}/month subscription for ${purchase.quantity} websites, before discounts and tax.` : 'I agree to pay today’s amount and add US$29/month to my subscription, before discounts and tax.'}</label>
          <button type="button" className="wt-button" disabled={busy || !confirmed} onClick={() => void buy()}>{busy ? 'Confirming payment…' : `${purchase.endsTrial ? 'Proceed to upgrade / add website' : 'Confirm purchase'} · ${money(purchase.amountDue, purchase.currency)}`}</button>
        </section>}
        {purchase?.status === 'pending' && <section>
          <p>Payment needs attention. {purchase.endsTrial ? 'Your existing trial keeps its original end date while this upgrade awaits payment.' : 'Your existing websites remain available.'} The new slot stays locked until payment is confirmed.</p>
          {purchase.invoiceUrl ? <a href={purchase.invoiceUrl} target="_blank" rel="noopener noreferrer" className="wt-button">Complete payment securely</a> : <p>Update your payment details in Manage billing, then review this purchase again.</p>}
          <button type="button" className="wt-button secondary" disabled={busy} onClick={() => void refresh()}>Refresh payment status</button>
          <button type="button" className="wt-button secondary" disabled={busy} onClick={() => void cancelPending()}>Cancel unpaid purchase</button>
        </section>}
        {!busy && (error || !purchase) && <button type="button" className="wt-button secondary" onClick={() => void review()}>Review price again</button>}
        {notice && <a href="/onboarding" className="wt-button">Create a website</a>}
      </div>
    </dialog>
  </section>
}
