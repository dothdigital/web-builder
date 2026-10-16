import { PublicPageSchema } from '@/components/public-page-schema'
import { pageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categories, guides, guideBySlug, guideScreenshots } from '../guides'
import { Screenshot } from '../screenshot'
import { Walkthrough } from '../walkthrough'
import { guideVideo } from '../videos'
import styles from '../support.module.css'
export function generateStaticParams() { return guides.map(({slug})=>({slug})) }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
 const {slug}=await params; const guide=guideBySlug(slug)
 if (!guide) return { title: 'Guide not found | Webtummy', robots: { index: false, follow: true } }
 return pageMetadata(`/support/${slug}`, `${guide.title} | Webtummy Help`, guide.description)
}
export default async function GuidePage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const guide=guideBySlug(slug); if(!guide)notFound()
 const category=categories.find(c=>c.id===guide.category)!
 const related=guides.filter(g=>g.category===guide.category && g.slug!==guide.slug)
 return <div className={styles.container}>
  <PublicPageSchema path={`/support/${slug}`} title={guide.title} description={guide.description} />
  <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/support">Help center</Link><span aria-hidden>/</span><Link href="/support">{category.label}</Link><span aria-hidden>/</span><span>Guide</span></nav>
  <div className={styles.articleLayout}><article className={styles.article}>
   <header className={styles.articleHeader}><p className={styles.eyebrow}>{category.label}</p><h1>{guide.title}</h1><p>{guide.description}</p><div className={styles.articleMeta}><span>{guide.steps.length} clear steps</span><span>Real product screenshots</span></div></header>
   {guideVideo[guide.slug] && <Walkthrough id={guideVideo[guide.slug]}/>}
   <Screenshot image={guide.image} title={guide.title}/>
   <section className={styles.stepsSection} aria-label="Step-by-step instructions"><h2>Follow these steps</h2><ol className={styles.steps}>{guide.steps.map(([title,body],i)=><li key={title} id={`step-${i+1}`}><span className={styles.stepNumber} aria-hidden>{String(i+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
   {guideScreenshots[guide.slug]?.length > 0 && <details className={styles.moreScreenshots}><summary>More screenshots for this guide <span aria-hidden>＋</span></summary><div>{guideScreenshots[guide.slug].map(([image,title])=><section key={image}><h3>{title}</h3><Screenshot image={image} title={title}/></section>)}</div></details>}
   {guide.tip && <aside className={styles.tip}><strong>Good to know</strong><p>{guide.tip}</p></aside>}
   <div className={styles.result}><span aria-hidden>✓</span><div><strong>What you should see</strong><p>{guide.result}</p></div></div>
   <section className={styles.articleHelp}><div><h2>Need a hand with this step?</h2><p>Tell us the website, page, and control you’re using. Include any error code so we can help you faster.</p></div><Link href="/contact">Contact support →</Link></section>
   {related.length>0 && <section className={styles.related}><h2>Keep exploring</h2><div className={styles.guideGrid}>{related.slice(0,4).map(g=><Link key={g.slug} href={`/support/${g.slug}`} className={styles.guideCard}><h3>{g.title}</h3><p>{g.description}</p><span className={styles.cardMeta}>{g.steps.length} steps <b aria-hidden>→</b></span></Link>)}</div></section>}
  </article><aside className={styles.articleAside}><Link href="/support" className={styles.backLink}>← All guides</Link><h2>IN THIS GUIDE</h2><nav aria-label="On this page">{guide.steps.map(([title],i)=><a key={title} href={`#step-${i+1}`}><small>{String(i+1).padStart(2,'0')}</small>{title}</a>)}</nav><div className={styles.helpAside}><strong>Try it as you read.</strong><p>Open the editor in another tab and follow each step.</p><Link href="/dashboard" target="_blank" rel="noreferrer">Open workspace ↗</Link></div><div className={styles.keyboardTip}><strong>Useful shortcuts</strong><p><kbd>Ctrl / ⌘</kbd> + <kbd>S</kbd> Save</p><p><kbd>Ctrl / ⌘</kbd> + <kbd>Z</kbd> Undo</p><p><kbd>Shift</kbd> + click: multi-select</p></div></aside></div>
 </div>
}
