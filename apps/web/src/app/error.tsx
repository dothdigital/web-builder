'use client'
import { ErrorNotice } from '@/components/error-notice'
export default function ErrorPage(_: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl space-y-4 px-6 py-24"><h1 className="text-2xl font-semibold">We couldn’t complete this request.</h1><ErrorNotice code="WT-SYSTEM-500" message="Please retry. If the problem continues, contact support with the error code." /><button className="rounded bg-neutral-900 px-4 py-2 text-white" onClick={() => window.location.reload()}>Try again</button><a className="ml-4 underline" href="/dashboard">Back to websites</a></main>
}
