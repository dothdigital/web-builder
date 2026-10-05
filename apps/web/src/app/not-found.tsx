import Link from 'next/link'
import { ErrorNotice } from '@/components/error-notice'
export default function NotFound() {
  return <main className="mx-auto max-w-xl space-y-4 px-6 py-24"><h1 className="text-2xl font-semibold">Page unavailable</h1><ErrorNotice code="WT-PAGE-404" message="This page doesn’t exist or isn’t available to your account." /><Link className="inline-block underline" href="/dashboard">Back to websites</Link></main>
}
