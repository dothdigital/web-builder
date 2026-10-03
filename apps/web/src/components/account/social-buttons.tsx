import { socialAvailability } from '@/lib/social-auth'
import { socialSignIn } from '@/app/actions/account'
import { ActionForm } from './action-form'
export function SocialButtons({ connecting = false }: { connecting?: boolean }) {
  const enabled = socialAvailability()
  return <div className="wt-social-login"><ActionForm action={socialSignIn} disabled={!enabled.google} label={`${connecting ? 'Connect' : 'Continue with'} Google`}><input type="hidden" name="provider" value="google" /></ActionForm><ActionForm action={socialSignIn} disabled={!enabled.microsoft} label={`${connecting ? 'Connect' : 'Continue with'} Microsoft`}><input type="hidden" name="provider" value="microsoft-entra-id" /></ActionForm>{!enabled.google && !enabled.microsoft && <small>Social sign-in is being set up. Email sign-in is available below.</small>}{!connecting && <div className="wt-or"><span>or use your email</span></div>}</div>
}
