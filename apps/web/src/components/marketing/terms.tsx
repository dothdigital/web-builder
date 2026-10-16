import Link from 'next/link'
import styles from './marketing.module.css'

export function MarketingTerms() {
  return (
    <div data-screen-label="Terms of Service">
      <section className={styles.s1}>
        <div className={styles.s402}>
          <div className={styles.s168}>WebTummy</div>
          <h1 className={styles.s391}>Terms of Service</h1>
          <div className={styles.s403}>Effective 15 October 2026</div>
          <p className={styles.s392}>{"These Terms govern webtummy.com and the WebTummy website builder, hosting and related services (the 'Service'). References to 'WebTummy', 'we' and 'us' refer to the contracting operator identified in section 12."}</p>
          <p className={styles.s392}>{"By creating an account or using the Service you accept these Terms and the pricing and plan terms shown at checkout. If you do not agree, do not use the Service. These Terms do not remove consumer protections that applicable law makes non-waivable."}</p>
          <nav className={styles.s404} aria-label="Legal documents">
            <Link className={styles.s405} href="/privacy">Privacy Policy</Link>
            <Link className={styles.s406} href="/terms">Terms of Service</Link>
          </nav>
        </div>
      </section>
      <section className={styles.s407}>
        <section className={styles.s408} aria-labelledby="terms-section-1">
          <h2 className={styles.s409} id="terms-section-1">{"1. Accounts and eligibility"}</h2>
          <p className={styles.s410}>{"You must have reached the age of majority where you live and have authority to agree on behalf of your business if relevant. Give accurate account information, safeguard login credentials and report suspected unauthorized access promptly. You are responsible for activities you authorize and workspace-member permissions."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-2">
          <h2 className={styles.s409} id="terms-section-2">{"2. The Service and your plan"}</h2>
          <p className={styles.s410}>{"WebTummy helps you create, edit and manage websites. Features, website limits, AI usage, storage and publishing depend on your plan and the capabilities actually made available. A draft or preview is not a live published website. Domain ownership, DNS, third-party services and separate subscriptions remain your responsibility. Keep independent copies of important original materials."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-3">
          <h2 className={styles.s409} id="terms-section-3">{"3. Fees, renewals and cancellation"}</h2>
          <p className={styles.s410}>{"Checkout presents the price, currency, billing period, taxes, any trial terms and recurring charges before purchase. Subscriptions renew until cancelled as disclosed at checkout. You may cancel through Plans & Billing when available or contact "}<a className={styles.s291} href="mailto:billing@webtummy.com">{"billing@webtummy.com"}</a>{" before renewal. Cancellation generally stops future renewals and takes effect at the close of the paid term unless applicable law or checkout terms require otherwise. Refunds are governed by the refund terms disclosed at purchase and mandatory legal rights."}</p>
          <p className={styles.s410}>{"Deleting an account does not by itself cancel a subscription. We will provide legally required notice of material price changes before they affect your renewal, and you may cancel before the new fee applies."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-4">
          <h2 className={styles.s409} id="terms-section-4">{"4. Customer Content, generated websites and platform rights"}</h2>
          <p className={styles.s410}>{"Customer Content is material you provide, including logos, text, photographs, business details and uploaded files. You retain your existing rights in Customer Content, subject to others' rights."}</p>
          <p className={styles.s410}>{"A Generated Website is the assembled website experience produced using WebTummy, including pages, layout, structure and design, provided and operated within the hosted Service. The WebTummy Platform is our editor, templates, components, software, AI workflows, rendering and generation systems, hosting infrastructure and other proprietary technology, which remain owned by us or our licensors."}</p>
          <p className={styles.s410}>{"WebTummy is a fully managed hosted platform. Subscription fees are not a purchase of underlying source code, platform software, templates, components or rendering systems. Unless we expressly agree otherwise in writing, source-code downloads or exports of the generated hosted website are not provided on cancellation or termination."}</p>
          <p className={styles.s410}>{"You give us a non-exclusive permission to host, store, reproduce, process, transmit and display Customer Content solely as reasonably required to provide, secure and support the Service and publication you request, including through necessary service providers. You warrant that you have the rights needed for uploaded and published materials. Third-party assets are subject to their own licences."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-5">
          <h2 className={styles.s409} id="terms-section-5">{"5. AI-generated material"}</h2>
          <p className={styles.s410}>{"AI output may be inaccurate, incomplete, non-unique or unsuitable for your needs. You are responsible for reviewing claims, intellectual-property rights, accessibility, security and legal compliance before publishing. We do not guarantee originality, copyright protection, traffic, SEO rankings or commercial outcomes. AI use remains subject to applicable law, third-party rights and any relevant provider terms."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-6">
          <h2 className={styles.s409} id="terms-section-6">{"6. Acceptable use and platform protection"}</h2>
          <p className={styles.s410}>{"Do not use the Service for illegal content, infringement, harassment, exploitation, unlawful discrimination, phishing, malware, fraud or unsolicited messages. Do not access other users' accounts, evade usage limits, disrupt infrastructure or conduct unauthorized security tests. You are responsible for your website's claims, transactions, privacy notices, tracking permissions and marketing consent."}</p>
          <p className={styles.s410}>{"We may investigate suspected misuse and take proportionate protective measures, including restriction, suspension or removal of clearly unlawful or dangerous content, as reasonably necessary to protect users, third parties and the Service. Where practical and lawful, we will provide notice and an opportunity to remedy violations; urgent security or legal risks may require earlier intervention."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-7">
          <h2 className={styles.s409} id="terms-section-7">{"7. Privacy and integrations"}</h2>
          <p className={styles.s410}>{"Our Privacy Policy at "}<a className={styles.s291} href="/privacy">{"https://webtummy.com/privacy"}</a>{" explains our handling of personal information. You determine the legal purposes and permissions for information collected from visitors to your websites. Optional sign-in, AI, payment and other integrations are subject to their own terms and privacy practices. Hosting primary application systems in Canada does not imply that every service provider processes data only in Canada."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-8">
          <h2 className={styles.s409} id="terms-section-8">{"8. Trial, payment access, hosting, suspension and retention"}</h2>
          <p className={styles.s410}>{"The Individual plan includes one 7-day free trial for eligible new customers, followed by US$29 per month. Payment-card details are required at checkout; a trial starts only once Stripe confirms the subscription. During the trial, website creation, editing, AI generation and hosting are available. The saved payment method is charged automatically when the trial ends unless you cancel beforehand."}</p>
          <p className={styles.s410}>{"Cancelling during the trial preserves access until its scheduled end and avoids the first subscription charge. If the first post-trial payment fails, the grace period provided to previously paid subscribers does not apply: access and hosting may be suspended until payment succeeds. Reactivation does not create another trial. Outside a confirmed trial, payment is required before creation, editing or AI generation unless a platform administrator grants an exemption."}</p>
          <p className={styles.s410}>{"Administrative and support accounts are not subject to subscription-payment requirements. After a failed renewal, previously paid customers retain seven days of full website and editor access. From day 8 through day 30 following the failed payment, the website remains live while editing and AI features are restricted. After 30 unpaid days, or when a paid-term cancellation takes effect, hosting may be suspended and a neutral temporary page displayed."}</p>
          <p className={styles.s410}>{"Saved website content and data are retained for at least 90 days after suspension to permit reactivation. We send multiple warnings before reviewing data for permanent deletion after that period. Legal holds and mandatory retention requirements take precedence. Suspension does not immediately delete content. Necessary billing and account notices are distinct from optional marketing. For payment or recovery help contact "}<a className={styles.s291} href="mailto:billing@webtummy.com">{"billing@webtummy.com"}</a>{"."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-9">
          <h2 className={styles.s409} id="terms-section-9">{"9. Availability, disclaimers and liability"}</h2>
          <p className={styles.s410}>{"To the extent permitted by applicable law, the Service is provided 'as is' and 'as available', without a guarantee of uninterrupted operation, error-free results or fitness for a particular business objective. We are not liable for indirect, special or consequential damages to the extent their exclusion is legally permitted. Our total monetary liability arising from or relating to the Service is limited to the fees you paid us for the Service in the 12 months preceding the event giving rise to the claim."}</p>
          <p className={styles.s410}>{"These limits do not exclude or reduce liability for fraud, wilful misconduct, or any right, guarantee, remedy or liability that cannot be excluded or limited under applicable law. Nothing limits a consumer's non-waivable statutory remedies."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-10">
          <h2 className={styles.s409} id="terms-section-10">{"10. Business claims and disputes"}</h2>
          <p className={styles.s410}>{"If you use WebTummy for business, you agree, to the extent permitted by law, to indemnify us against reasonable third-party claims and related costs arising from your unlawful content, infringement of third-party rights, or material breach of these Terms, excluding losses attributable to our own misconduct. We will provide reasonably prompt notice and an opportunity to participate in the defence."}</p>
          <p className={styles.s410}>{"You may first contact "}<a className={styles.s291} href="mailto:legal@webtummy.com">{"legal@webtummy.com"}</a>{" to attempt informal resolution. Ontario law and applicable Canadian federal law govern these Terms, with Ontario courts having jurisdiction except where mandatory consumer or other laws provide otherwise. Nothing in this clause requires you to waive mandatory statutory procedures or rights."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-11">
          <h2 className={styles.s409} id="terms-section-11">{"11. Changes, notices and assignment"}</h2>
          <p className={styles.s410}>{"We may update these Terms prospectively to reflect changes in law, security, product operations or business needs. Material changes will be notified through reasonable customer channels and will take effect as stated in the notice, subject to applicable law and any required affirmative consent. Continued use only constitutes acceptance where legally effective."}</p>
          <p className={styles.s410}>{"To the extent permitted by law, we may assign or transfer our rights and obligations under these Terms to an affiliate, successor or purchaser in connection with a corporate reorganization, establishment of an independent WebTummy company, merger, or sale of all or substantially all of the WebTummy business. Such transfer is subject to applicable notices, consents, third-party contractual restrictions and assumption of obligations by the successor. Privacy transfers remain subject to the Privacy Policy and applicable privacy law. This clause does not itself transfer payment mandates or subscriptions where payment-provider approval or customer authorization is required."}</p>
          <p className={styles.s410}>{"You may not assign your account or these Terms without our consent except where law requires otherwise. If one provision is invalid, the remainder remains effective. A failure to enforce a term does not waive it. These Terms plus purchase-specific disclosures form the agreement for the Service."}</p>
        </section>
        <section className={styles.s408} aria-labelledby="terms-section-12">
          <h2 className={styles.s409} id="terms-section-12">{"12. Contact and legal identity"}</h2>
          <p className={styles.s410}>{"General support: "}<a className={styles.s291} href="mailto:support@webtummy.com">{"support@webtummy.com"}</a>{". Billing, cancellation and recovery: "}<a className={styles.s291} href="mailto:billing@webtummy.com">{"billing@webtummy.com"}</a>{". Privacy: "}<a className={styles.s291} href="mailto:privacy@webtummy.com">{"privacy@webtummy.com"}</a>{". Legal notices, disputes and content rights complaints: "}<a className={styles.s291} href="mailto:legal@webtummy.com">{"legal@webtummy.com"}</a>{"."}</p>
          <p className={styles.s410}>{"WebTummy is presently operated by Dot H Digital Inc., an Ontario corporation, doing business under the WebTummy brand. Dot H Digital Inc. is the contracting supplier until any legally effective transfer or replacement is communicated."}</p>
          <p className={styles.s410}>{"Current contracting operator: Dot H Digital Inc., doing business as WebTummy, Ontario, Canada. A dedicated, working WebTummy telephone number and applicable business/postal address must be provided wherever required by consumer law or other applicable legal-disclosure rules. Do not substitute a generic development-agency support line for WebTummy's public product-support channel."}</p>
        </section>
      </section>
    </div>
  )
}
