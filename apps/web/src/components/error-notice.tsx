import type { ReactNode } from 'react'
import { SUPPORT_EMAIL, type ErrorCode } from '@/lib/error-codes'

export function ErrorNotice({ message, code = 'WT-REQUEST-001', className = '' }: { message: ReactNode; code?: ErrorCode; className?: string }) {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Webtummy support — ${code}`)}&body=${encodeURIComponent(`Error code: ${code}\n\nPlease describe what you were doing:\n`)}`
  return <span role="alert" className={`block ${className}`} data-error-code={code}>
    <span className="block">{message}</span>
    <span className="mt-1 block text-xs">Error code: <code>{code}</code> · Please send this error code and details to <a className="underline" href={href}>{SUPPORT_EMAIL}</a></span>
  </span>
}
