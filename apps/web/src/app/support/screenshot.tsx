'use client'
import { useRef } from 'react'
import styles from './support.module.css'
export function Screenshot({ image, title }: { image: string; title: string }) {
 const dialog = useRef<HTMLDialogElement>(null)
 return <figure className={styles.screenshot}>
  <div className={styles.browserBar}><span aria-hidden><i/><i/><i/></span><small>WEBTUMMY · VISUAL WALKTHROUGH</small><button type="button" onClick={()=>dialog.current?.showModal()} aria-label={`Enlarge screenshot: ${title}`}>Enlarge ↗</button></div>
  <button className={styles.screenshotButton} type="button" onClick={()=>dialog.current?.showModal()} aria-label={`View full screenshot: ${title}`}><img src={`/support/${image}.webp`} alt={`Webtummy interface showing ${title.toLowerCase()}`} width={1600} height={1000} loading="lazy" /></button>
  <figcaption>Actual Webtummy interface in the fictional Willow Studio customer workspace. Click to enlarge. Available fields vary by selected component.</figcaption>
  <dialog ref={dialog} className={styles.lightbox} aria-label={`${title} screenshot`} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><div className={styles.lightboxTop}><strong>{title}</strong><button type="button" onClick={()=>dialog.current?.close()} aria-label="Close screenshot">Close ×</button></div><div className={styles.lightboxImage}><img src={`/support/${image}.webp`} alt={`Expanded Webtummy interface showing ${title.toLowerCase()}`} /></div></dialog>
 </figure>
}
