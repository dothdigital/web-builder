'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useRef, useState, type FormEvent } from 'react'
import { RecaptchaLoader } from '@/components/recaptcha-loader'

export function ContactForm({ siteKey, captchaType, available }: { siteKey?: string; captchaType: 'v2' | 'v3'; available: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [captchaReady, setCaptchaReady] = useState(captchaType !== 'v3' || !siteKey)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !available || !captchaReady) return
    setPending(true)
    setResult(null)
    const data = new FormData(event.currentTarget)
    try {
      let captchaToken = data.get('g-recaptcha-response') || ''
      if (siteKey && captchaType === 'v3') {
        const captcha = (window as unknown as { grecaptcha?: { execute: (key: string, options: { action: string }) => Promise<string> } }).grecaptcha
        if (!captcha) throw new Error('SecurityCheckUnavailable')
        captchaToken = await captcha.execute(siteKey, { action: 'contact' })
      }
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'), email: data.get('email'), subject: data.get('subject'), message: data.get('message'),
          website: data.get('website') || '', captchaToken,
        }),
        signal: AbortSignal.timeout(35000),
      })
      const outcome = await response.json() as { ok?: boolean; message?: string }
      const ok = response.ok && outcome.ok === true
      setResult({ ok, message: outcome.message || 'Unable to send your message. Please try again.' })
      if (ok) formRef.current?.reset()
    } catch { setResult({ ok: false, message: 'We could not confirm your submission. Please check your connection and try again.' }) }
    finally {
      const captcha = (window as unknown as { grecaptcha?: { reset: () => void } }).grecaptcha
      if (siteKey && captchaType === 'v2') captcha?.reset()
      setPending(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="wt-form wt-contact-form" aria-label="Contact Webtummy">
      <div className="wt-contact-form-heading"><p className="wt-eyebrow">A LITTLE ABOUT YOU</p><h2>Send us a message.</h2></div>
      <label htmlFor="contact-name">Your name<input id="contact-name" name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="Your full name" required /></label>
      <label htmlFor="contact-email">Email address<input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
      <label htmlFor="contact-subject">What’s it about?<input id="contact-subject" name="subject" minLength={3} maxLength={150} placeholder="A quick subject for your message" required /></label>
      <label htmlFor="contact-message">Your message<textarea id="contact-message" name="message" minLength={10} maxLength={5000} rows={6} placeholder="Tell us what’s on your mind…" required /></label>
      <div className="wt-contact-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
      <p className="wt-contact-privacy">We’ll use your details to respond to your enquiry. Read our <Link href="/privacy">Privacy Policy</Link>. Please don’t include passwords or sensitive information.</p>
      {siteKey && <>{captchaType === 'v2' ? <><div className="g-recaptcha" data-sitekey={siteKey} /><RecaptchaLoader /></> : <Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`} onReady={() => {
        const captcha = (window as unknown as { grecaptcha?: { ready: (callback: () => void) => void } }).grecaptcha
        captcha?.ready(() => setCaptchaReady(true))
      }} onError={() => setResult({ ok: false, message: 'The security check could not load. Please refresh the page and try again.' })} />}<p className="wt-contact-privacy">This form uses Google reCAPTCHA. Google’s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> apply.</p></>}
      {!available && <p className="wt-contact-status" role="status">Our contact form is being set up. Please check back soon.</p>}
      {result && <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'wt-success' : 'wt-message'}>{result.message}</p>}
      <button className="wt-button" type="submit" disabled={pending || !available || !captchaReady}>{pending ? 'Sending…' : 'Send message ↗'}</button>
    </form>
  )
}
