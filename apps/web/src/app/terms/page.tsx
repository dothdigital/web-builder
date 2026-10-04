import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/account/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Use | Webtummy',
  description: 'Terms for using Webtummy’s website builder and related services, operated by DotH digital Inc. in Ontario, Canada.',
  alternates: { canonical: 'https://webtummy.com/terms' },
}

export default function TermsPage() {
  return <LegalPage title="Terms of Use" introduction="These terms govern Webtummy’s website, builder, and related services, operated by DotH digital Inc., Ontario, Canada (“we”, “us”). By creating an account or using the service, you agree to these terms. If you do not agree, do not use the service." sections={[
    {
      title: 'Accounts and eligibility',
      content: 'You must have reached the age of majority where you live and have authority to accept these terms for yourself or your organization. Provide accurate account details, protect your credentials, and promptly report unauthorized access. You are responsible for activity you authorize through your account and for permissions granted to workspace members.',
    },
    {
      title: 'The service and your plan',
      content: 'Webtummy helps you create, edit, and manage websites. Features, website limits, AI usage, storage, trials, and publishing access depend on the plan and availability shown in the service. A draft or preview is not a published website. Domain ownership, DNS configuration, third-party services, and any required subscriptions remain your responsibility. Do not use Webtummy as your only copy of important content.',
    },
    {
      title: 'Fees, renewals, and cancellation',
      content: 'The checkout identifies the price, currency, billing interval, applicable taxes, and any recurring charges before purchase. Recurring plans renew until cancelled as disclosed at checkout. Cancel through Plans & billing, if available, or contact info@dothdigital.com before renewal. Cancellation generally ends renewal and takes effect at the end of the paid period unless the checkout terms or applicable law require otherwise. Refunds follow the policy disclosed at purchase and mandatory legal rights. Account deletion alone does not replace subscription cancellation. We notify you of material price changes before they apply to a renewal; you may cancel before the new charge.',
    },
    {
      title: 'Your content and our platform',
      content: 'You retain rights you hold in your content. You grant us a non-exclusive licence to store, copy, process, transmit, and display it only to provide, secure, and support the service, including publication you request and processing by necessary providers. You must have permission to upload and use all text, images, trademarks, data, and reference material. Third-party assets remain subject to their licences. Our software, brand, and platform materials remain ours or our licensors’; your plan gives you permission to use the service, not ownership of its software.',
    },
    {
      title: 'AI-generated material',
      content: 'AI output can be inaccurate, incomplete, similar to other output, or unsuitable for your business. You must review facts, rights, accessibility, security, and legal compliance before relying on or publishing it. We do not guarantee originality, copyright protection, search rankings, traffic, or business results. Use of AI output is subject to applicable law, third-party rights, and relevant provider terms.',
    },
    {
      title: 'Acceptable use',
      content: 'Do not use the service for unlawful content, infringement, harassment, exploitation, discrimination prohibited by law, phishing, malware, fraud, or unsolicited messaging. Do not access others’ accounts, bypass usage limits, interfere with the platform, or conduct unauthorized security testing. You are responsible for your website’s claims, customer dealings, privacy notices, tracking permissions, and marketing consent, including compliance with Canada’s anti-spam law where applicable.',
    },
    {
      title: 'Privacy and third-party services',
      content: <>Our <Link href="/privacy">Privacy Policy</Link> explains our handling of personal information. Customer website owners determine how they collect and use visitor information and must have a lawful basis and any required permissions. Optional authentication, AI, payment, hosting, and other integrations have their own terms and privacy practices. We do not control their availability or content. Primary application hosting in Canada does not guarantee that every integrated service processes information only in Canada.</>,
    },
    {
      title: 'Suspension, termination, and changes',
      content: 'You may stop using the service and request account closure by contacting us. We may restrict content or suspend or terminate access for material breaches, non-payment, legal requirements, or security risks. Where reasonably possible, we explain the reason and give an opportunity to resolve it; urgent risks may require immediate action. Keep backups because termination or plan expiry may affect editing or hosting. We give reasonable advance notice of material service or terms changes where practicable. Changes do not remove accrued rights or override mandatory law.',
    },
    {
      title: 'Availability and liability',
      content: 'To the extent permitted by law, the service is provided “as is” and “as available,” without promises of uninterrupted access, error-free output, or suitability for a particular purpose. To that same extent, we are not liable for indirect or consequential losses, and our total liability arising from the service is limited to the fees you paid us for it in the 12 months before the event giving rise to the claim. These limits do not apply to fraud, wilful misconduct, or liability and warranties that applicable law does not allow us to exclude or limit.',
    },
    {
      title: 'Business claims and disputes',
      content: 'If you use Webtummy for a business, you agree, to the extent permitted by law, to cover reasonable third-party claims and costs caused by your unlawful content, infringement, or material breach of these terms, excluding amounts caused by our own misconduct. We will notify you and allow reasonable participation in the defence. Contact info@dothdigital.com first so we can try to resolve a dispute. Ontario law and applicable Canadian federal law govern these terms; Ontario courts have jurisdiction except where mandatory law gives you rights elsewhere. No mandatory consumer or privacy right is waived.',
    },
    {
      title: 'General terms and contact',
      content: 'These terms and the plan terms disclosed at purchase form our agreement for the service. If a provision is unenforceable, the remaining provisions continue to apply. A failure to enforce a term does not waive it. Questions, cancellation requests, and content or rights complaints may be sent to DotH digital Inc. at info@dothdigital.com.',
    },
  ]} />
}
