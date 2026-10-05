import type { Metadata } from 'next'
import { AccountConfirmation } from '@/components/account/account-confirmation'
import { EmailVerification } from '@/components/account/email-verification'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Verify Your Email | Webtummy', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <AccountConfirmation><EmailVerification key={token} token={token} /></AccountConfirmation>
}
