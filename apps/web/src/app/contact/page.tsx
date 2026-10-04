import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactForm } from '@/components/account/contact-form'
import { SiteFooter } from '@/components/account/site-footer'
import { contactEmailConfigured } from '@/lib/contact-email'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Contact Us | Webtummy',
  description: 'Get in touch with the Webtummy team. Ask a question, share an idea, or get help with your website.',
  alternates: { canonical: 'https://webtummy.com/contact' },
}

export default function ContactPage() {
  const siteKey = process.env.CONTACT_RECAPTCHA_SITE_KEY
  const secret = process.env.CONTACT_RECAPTCHA_SECRET_KEY
  const partialCaptcha = !!siteKey !== !!secret
  const captchaType = process.env.CONTACT_RECAPTCHA_TYPE || 'v2'
  const knownType = captchaType === 'v2' || captchaType === 'v3'
  return (
    <main className="wt-public wt-contact-page">
      <header><Link href="/" className="wt-brand"><span>W</span> webtummy</Link><Link href="/signin">Sign in →</Link></header>
      <section className="wt-contact-layout" aria-labelledby="contact-heading">
        <div className="wt-contact-copy">
          <p className="wt-eyebrow">LET’S TALK</p>
          <h1 id="contact-heading">Good ideas start<br />with a <em>conversation.</em></h1>
          <p>Have a question about Webtummy? Need a hand with your next website? Or just have an idea to share?</p>
          <p>Tell us a little about what you’re working on. We’re here to help you find your next step.</p>
          <div className="wt-contact-note"><span aria-hidden="true">✦</span><p>Your ideas. Your next chapter.<br /><strong>Let’s make something good.</strong></p></div>
        </div>
        <div className="wt-contact-card"><ContactForm siteKey={siteKey && secret && knownType ? siteKey : undefined} captchaType={captchaType === 'v3' ? 'v3' : 'v2'} available={contactEmailConfigured() && !partialCaptcha && knownType} /></div>
      </section>
      <SiteFooter />
    </main>
  )
}
