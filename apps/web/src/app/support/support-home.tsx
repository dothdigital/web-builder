'use client'
import Link from 'next/link'
import { useState } from 'react'
import { categories, guides } from './guides'
import { videos } from './videos'
import styles from './support.module.css'
export function SupportHome() {
 const [query,setQuery] = useState('')
 const [category,setCategory] = useState('all')
 const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
 const matching = guides.filter(g => (category === 'all' || g.category === category) && words.every(word => `${g.title} ${g.description} ${g.steps.flat().join(' ')} ${g.tip ?? ''}`.toLowerCase().includes(word)))
 return <>
  <section className={styles.hero}>
   <div className={styles.heroDots} aria-hidden /><p className={styles.eyebrow}>THE WEBTUMMY HELP CENTER</p>
   <h1>Your website.<br/><em>Every step, explained.</em></h1><p className={styles.heroCopy}>From your first page to your next big launch.<br/>Clear steps, real screenshots, and help at every click.</p>
   <div className={styles.searchWrap}><svg aria-hidden width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><label className={styles.srOnly} htmlFor="guide-search">Search support guides</label><input id="guide-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try ‘add a page’, ‘replace image’, or ‘publish’" aria-controls="guide-results" />{query && <button onClick={()=>setQuery('')} aria-label="Clear search">×</button>}</div>
   <div className={styles.popular}><span>POPULAR</span>{[['add-page','Add a page'],['generate-image','AI images'],['select-components','Component toolbar'],['publish','Go live']].map(([slug,label])=><Link key={slug} href={`/support/${slug}`}>{label} <span aria-hidden>↗</span></Link>)}</div>
  </section>
  <div className={styles.container}>
   {!query && category === 'all' && <section className={styles.startBanner}><div><span className={styles.smallLabel}>NEW HERE?</span><h2>Get to know your workspace.</h2><p>Learn the dashboard, find your tools, and make your first edit.</p></div><Link href="/support/editor-tour">Take the editor tour <span aria-hidden>→</span></Link></section>}
   {!query && category === 'all' && <section className={styles.videoLibrary} id="video-guides"><div className={styles.libraryHeading}><div><p className={styles.eyebrow}>SEE IT IN ACTION</p><h2>Watch. Try. Make it yours.</h2></div><span>6 captioned walkthroughs · Real customer workspace</span></div><div className={styles.videoCards}>{videos.map(v=><Link className={styles.videoCard} href={`/support/${v.guide}`} key={v.id}><div className={styles.videoPoster}><img src={`/support/${v.poster}.webp`} alt="" loading="lazy" width={1600} height={1000}/><span aria-hidden>▶</span></div><div><small>VIDEO + ILLUSTRATED GUIDE</small><h3>{v.title}</h3><p>{v.description}</p></div></Link>)}</div></section>}
   <div className={styles.libraryHeading}><div><p className={styles.eyebrow}>THE HOW-TO LIBRARY</p><h2>Find the guide you need.</h2></div><span>{guides.length} guides · {categories.length} collections</span></div>
   <div className={styles.library}>
    <aside className={styles.categoryNav}><h2>Browse by topic</h2><nav aria-label="Guide categories"><button aria-pressed={category==='all'} onClick={()=>setCategory('all')}><span>All guides</span><small>{guides.length}</small></button>{categories.map(c=><button key={c.id} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}><span>{c.label}</span><small>{guides.filter(g=>g.category===c.id).length}</small></button>)}</nav><div className={styles.helpAside}><span aria-hidden>✳</span><strong>A human can help, too.</strong><p>Stuck on something specific? Tell us what you’re trying to do.</p><Link href="/contact">Contact support →</Link></div></aside>
    <section id="guide-results" className={styles.results} aria-label="Support guides"><p className={styles.resultStatus} role="status" aria-live="polite">{words.length ? `${matching.length} ${matching.length===1?'guide':'guides'} found for “${query}”` : category==='all' ? 'Explore a collection, or search for a specific task.' : categories.find(c=>c.id===category)?.description}</p>
     {!matching.length && <div className={styles.empty}><h3>No matching guides yet.</h3><p>Try fewer words, another topic, or browse all guides.</p><button onClick={()=>{setQuery('');setCategory('all')}}>Reset search</button><Link href="/contact">Contact support →</Link></div>}
     {categories.filter(c=>matching.some(g=>g.category===c.id)).map(c=><section className={styles.collection} key={c.id}><div className={styles.collectionHeading}><span>{c.icon}</span><h3>{c.label}</h3></div><div className={styles.guideGrid}>{matching.filter(g=>g.category===c.id).map(g=><Link href={`/support/${g.slug}`} key={g.slug} className={styles.guideCard}><div><h4>{g.title}</h4><p>{g.description}</p></div><span className={styles.cardMeta}>{g.steps.length} steps <span aria-hidden>·</span> Illustrated guide <b aria-hidden>↗</b></span></Link>)}</div></section>)}
    </section>
   </div>
   <section className={styles.bottomBanner}><span aria-hidden>✦</span><div><h2>Ready to put it into practice?</h2><p>Keep a guide open beside the editor and follow along at your own pace.</p></div><Link href="/dashboard">Open your workspace ↗</Link></section>
  </div>
 </>
}
