'use client'
import { useActionState, type ReactNode } from 'react'
export function ActionForm({ action, children, label, className = '', disabled = false }: { action: (state: { message: string }, form: FormData) => Promise<{ message: string; ok?: boolean }>; children?: ReactNode; label: string; className?: string; disabled?: boolean }) {
  const [state, submit, pending] = useActionState(action, { message: '' })
  return <form action={submit} className={`wt-form ${className}`}>{children}{state.message && <p role="status" className={state.ok ? 'wt-success' : 'wt-message'}>{state.message}</p>}<button className="wt-button" type="submit" disabled={pending || disabled}>{pending ? 'Please wait…' : label}</button></form>
}
