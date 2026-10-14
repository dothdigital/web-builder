'use client'

import { useEffect, useRef, useState } from 'react'
import { layoutCatalogue, type LayoutChoice } from '@awb/shared/layout-catalogue'
import styles from './layout-gallery.module.css'

export function LayoutGallery({ onSelect }: { onSelect: (id?: string) => void }) {
  const [category, setCategory] = useState('All layouts')
  const [preview, setPreview] = useState<LayoutChoice>()
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (preview) dialog.current?.showModal() }, [preview])
  const categories = ['All layouts', ...new Set(layoutCatalogue.map(layout => layout.category))]
  const visible = layoutCatalogue.filter(layout => category === 'All layouts' || layout.category === category)
  const close = () => { dialog.current?.close(); setPreview(undefined) }
  return <div className={styles.gallery}>
    <p className="wt-eyebrow">CREATE YOUR WEBSITE · 1. CHOOSE A LAYOUT</p>
    <h1>Start with a layout you love.</h1>
    <p>Explore the designs, preview the pages, then choose your layout. We’ll ask about your business next and tailor the content to you.</p>
    <div className={styles.filters} aria-label="Filter layouts">{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
    <div className={styles.grid}>{visible.map(layout => <article key={layout.id} className={styles.card}>
      <button type="button" className={styles.thumbnail} aria-label={`Preview ${layout.name}`} onClick={() => { setDevice('desktop'); setPreview(layout) }}>
        {/* Uploaded theme screenshots are served as static assets. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={layout.thumbnail} alt={`${layout.name} homepage layout`} loading="lazy" width={720} height={540} />
      </button>
      <div className={styles.details}><span>{layout.category}</span><h2>{layout.name}</h2><div className={styles.actions}>
        <button type="button" className="wt-button secondary" onClick={() => { setDevice('desktop'); setPreview(layout) }}>Preview</button>
        <button type="button" className="wt-button" onClick={() => onSelect(layout.id)}>Use this layout</button>
      </div></div>
    </article>)}</div>
    <div className={styles.custom}><div><h2>Let us choose for you</h2><p>Prefer a fresh starting point? Create a design from your business details.</p></div><button type="button" className="wt-button secondary" onClick={() => onSelect(undefined)}>Create a custom design</button></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="layout-preview-title" onCancel={() => setPreview(undefined)}>
      {preview && <><header><div><h2 id="layout-preview-title">{preview.name}</h2><p>Sample content and photography. Your website will use your business details.</p></div><div className={styles.actions}>
        <button type="button" aria-pressed={device === 'desktop'} className="wt-button secondary" onClick={() => setDevice('desktop')}>Desktop</button>
        <button type="button" aria-pressed={device === 'mobile'} className="wt-button secondary" onClick={() => setDevice('mobile')}>Mobile</button>
        <button type="button" className="wt-button" onClick={() => { const id = preview.id; close(); onSelect(id) }}>Use this layout</button>
        <button type="button" className="wt-button secondary" onClick={close}>Close</button>
      </div></header><div className={styles.previewSurface}><iframe key={preview.id} title={`${preview.name} full preview`} src={preview.preview} sandbox="allow-scripts" referrerPolicy="no-referrer" className={device === 'mobile' ? styles.mobile : styles.desktop} /></div></>}
    </dialog>
  </div>
}
