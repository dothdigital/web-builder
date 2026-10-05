import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteFooter } from './site-footer'

export function LegalPage({ title, introduction, sections, effectiveDate = 'October 4, 2026' }: {
  title: string
  effectiveDate?: string
  introduction: ReactNode
  sections: { title: string; content: ReactNode }[]
}) {
  return (
    <main className="wt-public wt-legal-page">
      <header>
        <Link href="/" className="wt-brand"><span>W</span> webtummy</Link>
        <Link href="/signin">Sign in →</Link>
      </header>
      <article className="wt-legal-document">
        <p className="wt-eyebrow">DOTH DIGITAL INC. · ONTARIO, CANADA</p>
        <h1>{title}</h1>
        <p className="wt-legal-date">Effective {effectiveDate}</p>
        <p className="wt-legal-intro">{introduction}</p>
        <nav className="wt-legal-switch" aria-label="Legal documents">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </nav>
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-section-${index + 1}`}>
            <h2 id={`legal-section-${index + 1}`}>{index + 1}. {section.title}</h2>
            <p>{section.content}</p>
          </section>
        ))}
        <p className="wt-legal-contact">Questions? Contact DotH digital Inc. at <a href="mailto:info@dothdigital.com">info@dothdigital.com</a>.</p>
      </article>
      <SiteFooter />
    </main>
  )
}
