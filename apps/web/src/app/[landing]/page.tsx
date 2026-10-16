import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingShell } from '@/components/marketing/shell'
import { pageMetadata } from '@/lib/seo'
import { WEBSITE_BUILDER_PAGES, websiteBuilderPage } from '@/lib/seo-landings'
import styles from './landing.module.css'

export const dynamicParams = false
export function generateStaticParams() { return WEBSITE_BUILDER_PAGES.map(page => ({ landing: page.slug })) }

export async function generateMetadata({ params }: { params: Promise<{ landing: string }> }): Promise<Metadata> {
  const { landing } = await params
  const page = websiteBuilderPage(landing)
  if (!page) notFound()
  return pageMetadata(`/${page.slug}`, page.title, page.description)
}

export default async function WebsiteBuilderPage({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params
  const page = websiteBuilderPage(landing)
  if (!page) notFound()
  return <MarketingShell active={`/${page.slug}`}>
    <article className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.wrap}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span>{page.label}</span></nav>
          <div className={styles.heroGrid}>
            <div><p className={styles.eyebrow}>WEBSITES, WITH WEBTUMMY</p><h1>{page.heading}</h1><p className={styles.intro}>{page.intro}</p>
              <div className={styles.actions}><Link href="/signup" className={styles.primary}>Start your free trial <span aria-hidden="true">↗</span></Link><Link href="/pricing" className={styles.secondary}>See pricing</Link></div>
              <p className={styles.note}>7 days free for eligible new customers, then US$29/month for one website. Card required. Cancel before your trial ends to avoid a charge.</p>
            </div>
            <figure className={styles.screenshot}><div className={styles.browser}><span aria-hidden="true">● ● ●</span><span>INSIDE WEBTUMMY</span></div>
              <a href={`/support/${page.image}.webp`} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size image: ${page.imageAlt}`}><Image src={`/support/${page.image}.webp`} alt={page.imageAlt} width={1600} height={1000} sizes="(max-width: 850px) 100vw, 50vw" priority /></a>
              <figcaption>{page.imageCaption} Select the image to see it full size.</figcaption>
            </figure>
          </div>
        </div>
      </div>
      <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="use-case"><div className={styles.sectionHeading}><p className={styles.eyebrow}>THE RIGHT STARTING POINT</p><h2 id="use-case">{page.problem.heading}</h2><p>{page.problem.text}</p></div>
        <div className={styles.cards}>{page.sections.map((section, index) => <div className={styles.card} key={section.title}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><h3>{section.title}</h3><p>{section.text}</p></div>)}</div>
      </section>
      <section className={styles.example} aria-labelledby="example"><div className={`${styles.wrap} ${styles.section}`}><p className={styles.eyebrow}>A CONCRETE STARTING BRIEF</p><h2 id="example">{page.example.heading}</h2><p className={styles.exampleLabel}>Illustrative example to adapt to your own business; this is not a customer case study.</p>
        <blockquote>{page.example.brief}</blockquote>
        <div className={styles.cards}>{page.example.pages.map(item => <div className={styles.exampleCard} key={item.name}><h3>{item.name}</h3><p>{item.content}</p></div>)}</div>
      </div></section>
      <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="workflow"><div className={styles.sectionHeading}><p className={styles.eyebrow}>FROM DRAFT TO PUBLISHED</p><h2 id="workflow">Build it. Review it. Make it yours.</h2></div><ol className={styles.steps}>{page.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <div className={styles.evidence}><h3>See the real product workflow</h3><p>These illustrated guides show the editor controls used for this kind of website.</p><div className={styles.guideLinks}>{page.guides.map(guide => <Link key={guide.slug} href={`/support/${guide.slug}`}>{guide.label} <span aria-hidden="true">→</span></Link>)}</div></div>
      </section>
      <section className={`${styles.wrap} ${styles.section} ${styles.questions}`} aria-labelledby="questions"><h2 id="questions">Questions about {page.label.toLowerCase()}</h2>{page.questions.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
      <section className={styles.cta}><div className={styles.wrap}><h2>Give your next chapter a website.</h2><p>Build with AI, edit visually and publish with managed hosting.</p><div className={styles.actions}><Link href="/signup" className={styles.primary}>Start your free trial <span aria-hidden="true">↗</span></Link><Link href="/how-it-works" className={styles.secondary}>See how Webtummy works</Link></div></div></section>
      <nav className={`${styles.wrap} ${styles.related}`} aria-label="More website builder guides"><h2>Explore another way to build</h2><div className={styles.guideLinks}>{WEBSITE_BUILDER_PAGES.filter(item => item.slug !== page.slug).map(item => <Link key={item.slug} href={`/${item.slug}`}>{item.label} <span aria-hidden="true">→</span></Link>)}</div></nav>
    </article>
  </MarketingShell>
}
