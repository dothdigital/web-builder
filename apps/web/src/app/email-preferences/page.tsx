import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { unsubscribeMarketing } from '@/app/actions/marketing'
export const metadata = { title: 'Email preferences · Webtummy', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function EmailPreferences({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <AuthFrame title="Your inbox, your choice." description="Stop Webtummy onboarding and promotional emails. Security and account emails will continue."><ActionForm action={unsubscribeMarketing} label="Unsubscribe"><input type="hidden" name="token" value={token ?? ''} /></ActionForm></AuthFrame>
}
