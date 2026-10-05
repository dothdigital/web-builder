import { ContactForm } from '@/components/account/contact-form'
import { contactEmailConfigured } from '@/lib/contact-email'
import styles from './marketing.module.css'

export function MarketingContactForm() {
  const siteKey = process.env.CONTACT_RECAPTCHA_SITE_KEY
  const secret = process.env.CONTACT_RECAPTCHA_SECRET_KEY
  const partialCaptcha = !!siteKey !== !!secret
  const captchaType = process.env.CONTACT_RECAPTCHA_TYPE || 'v2'
  const knownType = captchaType === 'v2' || captchaType === 'v3'
  return <div className={styles.contactForm}><ContactForm
    siteKey={siteKey && secret && knownType ? siteKey : undefined}
    captchaType={captchaType === 'v3' ? 'v3' : 'v2'}
    available={contactEmailConfigured() && !partialCaptcha && knownType}
  /></div>
}
