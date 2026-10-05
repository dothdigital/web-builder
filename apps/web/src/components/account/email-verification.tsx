'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { finishAccountToken, requestEmailVerification } from '@/app/actions/account'
import { ActionForm } from './action-form'
import { ErrorNotice } from '@/components/error-notice'
import styles from './account-confirmation.module.css'

export function EmailVerification({ token }: { token?: string }) {
  const router = useRouter()
  const started = useRef(false)
  const validToken = !!token && /^[a-f0-9]{64}$/.test(token)
  const [error, setError] = useState(validToken ? '' : 'Open the verification link in your welcome email, or request a new email below.')
  useEffect(() => {
    if (!validToken || started.current) return
    started.current = true
    const form = new FormData()
    form.set('token', token!)
    form.set('purpose', 'verify')
    finishAccountToken({ message: '' }, form).then(result => {
      if (result.ok) router.replace('/verify-email/verified')
      else setError(result.message)
    }).catch(() => setError('We could not complete verification. Please check your connection and try the link again.'))
  }, [router, token, validToken])

  if (!error) return <><span className={`${styles.icon} ${styles.loadingIcon}`} aria-hidden="true">✦</span><h1>Verifying your email…</h1><p role="status">One moment while we confirm your email address.</p></>
  return <><h1>Verify your email.</h1><ErrorNotice message={error} code="WT-AUTH-001" className="wt-message" /><ActionForm action={requestEmailVerification} label="Send verification email"><label htmlFor="verification-email">Email address<input id="verification-email" name="email" type="email" autoComplete="email" maxLength={254} required /></label></ActionForm><Link href="/signin" className={styles.secondary}>Already verified? Sign in →</Link></>
}
