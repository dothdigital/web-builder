'use client'
import { ErrorNotice } from '@/components/error-notice'
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ margin: '4rem auto', maxWidth: 640, padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}><h1>Webtummy couldn’t load.</h1><ErrorNotice code="WT-SYSTEM-500" message="Please retry or contact support with the error code." /><button style={{ marginTop: 24, padding: '10px 16px' }} onClick={reset}>Try again</button></body></html>
}
