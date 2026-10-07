'use client'
import { ErrorNotice } from '@/components/error-notice'
import Script from 'next/script'
import { unstable_rethrow } from 'next/navigation'
import { useActionState, useState, type ReactNode } from 'react'
export function ActionForm({ action, children, label, className = '', disabled = false, captchaSiteKey, plainErrors = false }: { action: (state: { message: string }, form: FormData) => Promise<{ message: string; ok?: boolean }>; children?: ReactNode; label: string; className?: string; disabled?: boolean; captchaSiteKey?: string; plainErrors?: boolean }) {
  const [captchaReady, setCaptchaReady] = useState(!captchaSiteKey)
  const [captchaError, setCaptchaError] = useState('')
  const [state, submit, pending] = useActionState(async (previous: { message: string; ok?: boolean; needsReload?: boolean }, form: FormData): Promise<{ message: string; ok?: boolean; needsReload?: boolean }> => {
    if (captchaSiteKey) {
      try {
        const captcha = (window as unknown as { grecaptcha?: { execute: (key: string, options: { action: string }) => Promise<string> } }).grecaptcha
        if (!captcha) throw new Error('SecurityCheckUnavailable')
        form.set('captchaToken', await captcha.execute(captchaSiteKey, { action: 'signup' }))
      } catch { return { message: 'The security check could not complete. Please refresh the page and try again.' } }
    }
    try { return await action(previous, form) }
    catch (error) {
      unstable_rethrow(error)
      const stale = error instanceof Error && (error.name === 'UnrecognizedActionError' || /(?:Server Action.*(?:not found|deployment)|Failed to find Server Action)/i.test(error.message))
      return { message: stale ? 'Webtummy was updated while this page was open. Reload this page, then submit again.' : 'The request could not complete. Please try again. If you already submitted successfully, check your email before retrying.', needsReload: stale }
    }
  }, { message: '' })
  return <form action={submit} className={`wt-form ${className}`}>{children}{captchaSiteKey && <><Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(captchaSiteKey)}`} onReady={() => {
    const captcha = (window as unknown as { grecaptcha?: { ready: (callback: () => void) => void } }).grecaptcha
    captcha?.ready(() => setCaptchaReady(true))
  }} onError={() => setCaptchaError('The security check could not load. Please refresh the page and try again.')} /><small>This form uses Google reCAPTCHA. Google’s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> apply.</small></>}{captchaError && (plainErrors ? <p role="alert" className="wt-message">{captchaError}</p> : <ErrorNotice code="WT-REQUEST-001" message={captchaError} className="wt-message" />)}{state.message && (state.ok ? <p role="status" className="wt-success">{state.message}</p> : plainErrors ? <p role="alert" className="wt-message">{state.message}</p> : <ErrorNotice code={state.needsReload ? "WT-REQUEST-002" : undefined} message={state.message} className="wt-message" />)}<button className="wt-button" type={state.needsReload ? "button" : "submit"} onClick={state.needsReload ? () => window.location.reload() : undefined} disabled={pending || disabled || !captchaReady}>{pending ? 'Please wait…' : state.needsReload ? 'Reload page' : label}</button></form>
}
