'use client'
import Script from 'next/script'
import { useActionState, useState, type ReactNode } from 'react'
export function ActionForm({ action, children, label, className = '', disabled = false, captchaSiteKey }: { action: (state: { message: string }, form: FormData) => Promise<{ message: string; ok?: boolean }>; children?: ReactNode; label: string; className?: string; disabled?: boolean; captchaSiteKey?: string }) {
  const [captchaReady, setCaptchaReady] = useState(!captchaSiteKey)
  const [captchaError, setCaptchaError] = useState('')
  const [state, submit, pending] = useActionState(async (previous: { message: string; ok?: boolean }, form: FormData) => {
    if (captchaSiteKey) {
      try {
        const captcha = (window as unknown as { grecaptcha?: { execute: (key: string, options: { action: string }) => Promise<string> } }).grecaptcha
        if (!captcha) throw new Error('SecurityCheckUnavailable')
        form.set('captchaToken', await captcha.execute(captchaSiteKey, { action: 'signup' }))
      } catch { return { message: 'The security check could not complete. Please refresh the page and try again.' } }
    }
    return action(previous, form)
  }, { message: '' })
  return <form action={submit} className={`wt-form ${className}`}>{children}{captchaSiteKey && <><Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(captchaSiteKey)}`} onReady={() => {
    const captcha = (window as unknown as { grecaptcha?: { ready: (callback: () => void) => void } }).grecaptcha
    captcha?.ready(() => setCaptchaReady(true))
  }} onError={() => setCaptchaError('The security check could not load. Please refresh the page and try again.')} /><small>This form uses Google reCAPTCHA. Google’s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> apply.</small></>}{captchaError && <p role="alert" className="wt-message">{captchaError}</p>}{state.message && <p role="status" className={state.ok ? 'wt-success' : 'wt-message'}>{state.message}</p>}<button className="wt-button" type="submit" disabled={pending || disabled || !captchaReady}>{pending ? 'Please wait…' : label}</button></form>
}
